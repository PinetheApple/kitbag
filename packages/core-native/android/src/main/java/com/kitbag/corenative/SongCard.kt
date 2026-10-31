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
import com.kitbag.corenative.transport.Song
import com.kitbag.corenative.transport.SongAction
import com.kitbag.corenative.transport.SongCommand
import com.kitbag.corenative.transport.SongPlayback
import com.kitbag.corenative.transport.SongProgress
import com.kitbag.corenative.transport.SongTransport
import com.kitbag.corenative.transport.mediaArtist
import kotlin.math.roundToInt

internal class SongCard(
  private val context: Context,
  private val session: MediaSessionCompat,
  private val channelId: String,
  private val launchIntent: PendingIntent?,
  private val actionIntent: (SongAction) -> PendingIntent,
  private val post: (Notification) -> Unit,
  private val onStopped: () -> Unit,
) {
  private var song: Song? = null
  private var transport: SongTransport? = null
  private var published: SongPlayback? = null
  private var postedPlaying: Boolean? = null
  private val clock = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  fun show(next: Song, playing: Boolean) {
    song = next
    transport = SongTransport(next, EngineTransport.sampleRate())
    published = null
    postedPlaying = null
    refresh(progress().copy(playing = playing))
  }

  fun handle(action: SongAction) {
    val songTransport = transport ?: return
    val commands = songTransport.commandsFor(progress(), action)
    if (SongCommand.Stop in commands) {
      commands.forEach(::execute)
      onStopped()
    } else {
      runCommands(songTransport, commands)
    }
  }

  fun seekTo(positionMillis: Long) {
    val songTransport = transport ?: return
    runCommands(songTransport, listOf(songTransport.seekTo(positionMillis)))
  }

  private fun runCommands(songTransport: SongTransport, commands: List<SongCommand>) {
    var expected = progress()
    for (command in commands) {
      execute(command)
      expected = songTransport.applied(expected, command)
    }
    refresh(expected)
  }

  fun release() {
    clock.removeCallbacks(tick)
    transport = null
  }

  private fun execute(command: SongCommand) {
    when (command) {
      SongCommand.Play -> EngineTransport.mixerPlay()
      SongCommand.Pause -> EngineTransport.mixerPause()
      SongCommand.Stop -> EngineTransport.mixerStop()
      is SongCommand.Seek -> EngineTransport.mixerSeek(command.frame)
    }
  }

  private fun progress() = SongProgress(EngineTransport.mixerPlaying(), EngineTransport.mixerPosition())

  private fun onTick() {
    val songTransport = transport ?: return
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
    if (postedPlaying != progress.playing) {
      postedPlaying = progress.playing
      post(notification(current, songTransport.actions(progress), progress.playing))
    }
    clock.removeCallbacks(tick)
    clock.postDelayed(tick, TICK_MILLIS)
  }

  private fun publishMetadata(current: Song, durationMillis: Long) {
    session.setMetadata(
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
    session.setPlaybackState(builder.build())
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
          .setMediaSession(session.sessionToken)
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
