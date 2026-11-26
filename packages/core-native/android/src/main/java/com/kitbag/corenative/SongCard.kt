package com.kitbag.corenative

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media.utils.MediaConstants
import com.kitbag.corenative.transport.CardFence
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongAction
import com.kitbag.corenative.transport.SongCardTag
import com.kitbag.corenative.transport.SongCommand
import com.kitbag.corenative.transport.SongControls
import com.kitbag.corenative.transport.SongEndWatch
import com.kitbag.corenative.transport.SongEngine
import com.kitbag.corenative.transport.SongOrder
import com.kitbag.corenative.transport.SongPlayback
import com.kitbag.corenative.transport.SongProgress
import com.kitbag.corenative.transport.SongSlots
import com.kitbag.corenative.transport.SongTransport
import com.kitbag.corenative.transport.mediaArtist
import kotlin.math.roundToInt

internal class SongCard(
  private val context: Context,
  private val openSession: () -> MediaSessionCompat,
  private val channelId: String,
  private val launchIntent: PendingIntent?,
  private val actionIntent: (SongAction) -> PendingIntent,
  private val post: (notification: Notification, playing: Boolean, cardNumber: Int) -> Unit,
  private val appRequests: () -> ((SongCommand, Int) -> Unit)?,
  fence: CardFence,
  private val onStarted: () -> Unit,
  private val onEnded: () -> Unit,
  private val onStopped: () -> Unit,
) {
  private val controls = SongControls(MixerEngine, fence)
  private val ends = SongEndWatch(EngineTransport::engineEndCount)
  private var cardNumber = CardFence.NONE
  private var session = CardFence.NONE
  private var followsPlayOrder = false
  private var order = SongOrder.ALONE
  private var reservedNext: Boolean? = null
  private var countingIn = false
  private var song: Song? = null
  private var transport: SongTransport? = null
  private var published: SongPlayback? = null
  private var postedPlaying: Boolean? = null
  private val clock = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  fun show(next: Song, card: SongCardTag, playing: Boolean, countingIn: Boolean) {
    cardNumber = card.cardNumber
    session = card.session
    followsPlayOrder = card.followsPlayOrder
    order = if (card.followsPlayOrder) card.order else SongOrder.ALONE
    song = next
    transport = SongTransport(next, EngineTransport.sampleRate())
    published = null
    postedPlaying = null
    this.countingIn = countingIn
    refresh(progress().shown(playing, countingIn))
  }

  fun order(next: SongOrder) {
    if (!followsPlayOrder || next == order) return
    order = next
    postedPlaying = null
    refresh()
  }

  fun handle(action: SongAction) {
    val songTransport = transport ?: return
    settle(controls.press(cardNumber, songTransport, ::progress, action, requests()))
  }

  fun seekTo(positionMillis: Long) {
    val songTransport = transport ?: return
    settle(controls.seek(cardNumber, songTransport, ::progress, positionMillis, requests()))
  }

  fun seekedInApp(positionFrames: Long) {
    val songTransport = transport ?: return
    refresh(songTransport.seekedInApp(progress(), positionFrames))
  }

  private fun requests(): ((SongCommand) -> Unit)? {
    val emit = appRequests() ?: return null
    val shownIn = session
    return { emit(it, shownIn) }
  }

  private fun settle(outcome: SongControls.Outcome) {
    when (outcome) {
      SongControls.Outcome.Dropped -> Unit
      SongControls.Outcome.Stopped -> onStopped()
      is SongControls.Outcome.Ran -> {
        if (outcome.started) onStarted()
        refresh(outcome.expected)
      }
    }
  }

  fun release() {
    clock.removeCallbacks(tick)
    transport = null
    if (reservedNext == true) openSession().setExtras(Bundle.EMPTY)
    reservedNext = null
  }

  private fun progress(): SongProgress {
    val playing = MixerEngine.playing()
    if (playing) countingIn = false
    return SongProgress(playing, MixerEngine.position(), countingIn, MixerEngine.rate())
  }

  private fun onTick() {
    val songTransport = transport ?: return
    if (ends.ended()) onEnded()
    if (songTransport.stale(published, progress(), SystemClock.elapsedRealtime())) refresh()
    else clock.postDelayed(tick, TICK_MILLIS)
  }

  private fun refresh(known: SongProgress? = null) {
    val songTransport = transport ?: return
    val current = song ?: return
    val progress = known ?: progress()
    val playback = songTransport.playback(progress, order, SystemClock.elapsedRealtime())
    val slots = songTransport.slots(progress, order)
    if (published == null) publishMetadata(current, songTransport.durationMillis)
    reserveNext(slots.reserveNext)
    publishPlayback(playback, slots.actions)
    val playing = progress.shownPlaying
    if (postedPlaying != playing) {
      postedPlaying = playing
      post(notification(current, slots, playing), playing, cardNumber)
    }
    clock.removeCallbacks(tick)
    clock.postDelayed(tick, TICK_MILLIS)
  }

  private fun publishMetadata(current: Song, durationMillis: Long) {
    openSession().setMetadata(
      MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, current.title)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, mediaArtist(current.artist))
        .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMillis)
        .build(),
    )
  }

  private fun reserveNext(reserve: Boolean) {
    if (reservedNext == reserve) return
    reservedNext = reserve
    openSession().setExtras(
      Bundle().apply { putBoolean(MediaConstants.SESSION_EXTRAS_KEY_SLOT_RESERVATION_SKIP_TO_NEXT, reserve) },
    )
  }

  private fun publishPlayback(playback: SongPlayback, actions: List<SongAction>) {
    published = playback
    val builder = PlaybackStateCompat.Builder()
      .setState(playback.state, playback.positionMillis, playback.speed, playback.updatedAt)
      .setActions(playback.actions)
    actions.filter { it in CUSTOM_ACTIONS }.forEach {
      builder.addCustomAction(it.name, label(it), icon(it))
    }
    openSession().setPlaybackState(builder.build())
  }

  private fun notification(current: Song, slots: SongSlots, playing: Boolean): Notification =
    NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.kitbag_notification)
      .setContentTitle(current.title)
      .setContentText(mediaArtist(current.artist))
      .setContentIntent(launchIntent)
      .setOngoing(playing)
      .setDeleteIntent(actionIntent(SongAction.STOP))
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setStyle(
        MediaStyle()
          .setMediaSession(openSession().sessionToken)
          .setShowActionsInCompactView(*slots.compact.toIntArray()),
      )
      .apply { slots.actions.forEach { addAction(icon(it), label(it), actionIntent(it)) } }
      .build()

  private fun label(action: SongAction): String {
    val skipSeconds = song?.skipSeconds?.roundToInt() ?: 0
    return when (action) {
      SongAction.PLAY -> context.getString(R.string.kitbag_action_play)
      SongAction.PAUSE -> context.getString(R.string.kitbag_action_pause)
      SongAction.STOP -> context.getString(R.string.kitbag_action_stop)
      SongAction.REWIND -> context.getString(R.string.kitbag_action_rewind, skipSeconds)
      SongAction.FORWARD -> context.getString(R.string.kitbag_action_forward, skipSeconds)
      SongAction.PREVIOUS -> context.getString(R.string.kitbag_action_previous)
      SongAction.NEXT -> context.getString(R.string.kitbag_action_next)
    }
  }

  private companion object {
    const val TICK_MILLIS = 500L
    val CUSTOM_ACTIONS = setOf(SongAction.REWIND, SongAction.FORWARD, SongAction.STOP)

    fun icon(action: SongAction): Int =
      when (action) {
        SongAction.PLAY -> R.drawable.kitbag_play
        SongAction.PAUSE -> R.drawable.kitbag_pause
        SongAction.STOP -> R.drawable.kitbag_stop
        SongAction.REWIND -> R.drawable.kitbag_rewind_10
        SongAction.FORWARD -> R.drawable.kitbag_forward_10
        SongAction.PREVIOUS -> R.drawable.kitbag_previous
        SongAction.NEXT -> R.drawable.kitbag_next
      }
  }
}

private object MixerEngine : SongEngine {
  override fun execute(command: SongCommand) {
    when (command) {
      SongCommand.Play -> EngineTransport.mixerPlay()
      SongCommand.Pause -> EngineTransport.mixerPause()
      SongCommand.Stop -> EngineTransport.mixerStop()
      SongCommand.StopCountIn -> EngineTransport.songStop()
      is SongCommand.Seek -> EngineTransport.mixerSeek(command.frame)
      SongCommand.Next, SongCommand.Previous -> Unit
    }
  }

  override fun position(): Long = EngineTransport.mixerPosition()

  override fun playing(): Boolean = EngineTransport.mixerPlaying()

  fun rate(): Float = EngineTransport.mixerRate().toFloat()
}
