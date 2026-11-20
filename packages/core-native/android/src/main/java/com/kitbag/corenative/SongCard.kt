package com.kitbag.corenative

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import com.kitbag.corenative.transport.CardFence
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongAction
import com.kitbag.corenative.transport.SongCommand
import com.kitbag.corenative.transport.SongControls
import com.kitbag.corenative.transport.SongEndWatch
import com.kitbag.corenative.transport.SongEngine
import com.kitbag.corenative.transport.SongPlayback
import com.kitbag.corenative.transport.SongProgress
import com.kitbag.corenative.transport.SongTransport
import com.kitbag.corenative.transport.mediaArtist
import kotlin.math.roundToInt

internal class SongCard(
  private val context: Context,
  private val openSession: () -> MediaSessionCompat,
  private val channelId: String,
  private val launchIntent: PendingIntent?,
  private val actionIntent: (SongAction) -> PendingIntent,
  private val post: (Notification) -> Unit,
  private val appRequests: () -> ((SongCommand) -> Unit)?,
  fence: CardFence,
  private val onEnded: () -> Unit,
  private val onStopped: () -> Unit,
) {
  private val controls = SongControls(MixerEngine, fence)
  private val ends = SongEndWatch(EngineTransport::engineEndCount)
  private var cardNumber = CardFence.NONE
  private var countingIn = false
  private var song: Song? = null
  private var transport: SongTransport? = null
  private var published: SongPlayback? = null
  private var postedPlaying: Boolean? = null
  private val clock = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  fun show(next: Song, cardNumber: Int, playing: Boolean, countingIn: Boolean) {
    this.cardNumber = cardNumber
    song = next
    transport = SongTransport(next, EngineTransport.sampleRate())
    published = null
    postedPlaying = null
    this.countingIn = countingIn
    refresh(progress().shown(playing, countingIn))
  }

  fun handle(action: SongAction) {
    val songTransport = transport ?: return
    settle(controls.press(cardNumber, songTransport, ::progress, action, appRequests()))
  }

  fun seekTo(positionMillis: Long) {
    val songTransport = transport ?: return
    settle(controls.seek(cardNumber, songTransport, ::progress, positionMillis, appRequests()))
  }

  private fun settle(outcome: SongControls.Outcome) {
    when (outcome) {
      SongControls.Outcome.Dropped -> Unit
      SongControls.Outcome.Stopped -> onStopped()
      is SongControls.Outcome.Ran -> refresh(outcome.expected)
    }
  }

  fun release() {
    clock.removeCallbacks(tick)
    transport = null
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
    val playback = songTransport.playback(progress, SystemClock.elapsedRealtime())
    if (published == null) publishMetadata(current, songTransport.durationMillis)
    publishPlayback(playback, songTransport.actions(progress))
    if (postedPlaying != progress.shownPlaying) {
      postedPlaying = progress.shownPlaying
      post(notification(current, songTransport.actions(progress), progress.shownPlaying))
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

  // System media cards draw custom actions in the previous and next slots when those actions are absent.
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

  private fun notification(current: Song, actions: List<SongAction>, playing: Boolean): Notification =
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
          .setShowActionsInCompactView(*COMPACT_SLOTS),
      )
      .apply { actions.forEach { addAction(icon(it), label(it), actionIntent(it)) } }
      .build()

  private fun label(action: SongAction): String {
    val skipSeconds = song?.skipSeconds?.roundToInt() ?: 0
    return when (action) {
      SongAction.PLAY -> context.getString(R.string.kitbag_action_play)
      SongAction.PAUSE -> context.getString(R.string.kitbag_action_pause)
      SongAction.STOP -> context.getString(R.string.kitbag_action_stop)
      SongAction.REWIND -> context.getString(R.string.kitbag_action_rewind, skipSeconds)
      SongAction.FORWARD -> context.getString(R.string.kitbag_action_forward, skipSeconds)
    }
  }

  private companion object {
    const val TICK_MILLIS = 500L
    val COMPACT_SLOTS = intArrayOf(0, 1, 2)
    val CUSTOM_ACTIONS = setOf(SongAction.REWIND, SongAction.FORWARD, SongAction.STOP)

    fun icon(action: SongAction): Int =
      when (action) {
        SongAction.PLAY -> R.drawable.kitbag_play
        SongAction.PAUSE -> R.drawable.kitbag_pause
        SongAction.STOP -> R.drawable.kitbag_stop
        SongAction.REWIND -> R.drawable.kitbag_rewind_10
        SongAction.FORWARD -> R.drawable.kitbag_forward_10
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
    }
  }

  override fun position(): Long = EngineTransport.mixerPosition()

  override fun playing(): Boolean = EngineTransport.mixerPlaying()

  fun rate(): Float = EngineTransport.mixerRate().toFloat()
}
