package com.kitbag.corenative.transport

import android.support.v4.media.session.PlaybackStateCompat
import kotlin.math.abs
import kotlin.math.roundToLong

data class Song(
  val title: String,
  val artist: String?,
  val durationFrames: Long,
  val restartFromFrame: Long,
  val skipSeconds: Double,
) {
  // SystemUI formats the artist into "%1$s by %2$s", so a null would read as "null".
  val cardArtist: String get() = if (artist.isNullOrBlank()) "" else artist
}

data class SongProgress(val playing: Boolean, val positionFrames: Long)

enum class SongAction {
  REWIND,
  PLAY,
  PAUSE,
  FORWARD,
  STOP;

  companion object {
    fun named(name: String): SongAction? = entries.find { it.name == name }
  }
}

sealed interface SongCommand {
  data object Play : SongCommand

  data object Pause : SongCommand

  data object Stop : SongCommand

  data class Seek(val frame: Long) : SongCommand
}

data class SongPlayback(
  val state: Int,
  val positionMillis: Long,
  val speed: Float,
  val updatedAt: Long,
  val actions: Long,
) {
  fun positionAt(now: Long): Long = positionMillis + (speed * (now - updatedAt)).roundToLong()
}

class SongTransport(private val song: Song, private val sampleRate: Double) {

  val durationMillis: Long = millis(song.durationFrames)

  private val skipFrames: Long = (song.skipSeconds * sampleRate).roundToLong()

  fun actions(progress: SongProgress): List<SongAction> =
    listOf(
      SongAction.REWIND,
      if (progress.playing) SongAction.PAUSE else SongAction.PLAY,
      SongAction.FORWARD,
      SongAction.STOP,
    )

  fun playback(progress: SongProgress, now: Long): SongPlayback =
    SongPlayback(
      state = if (progress.playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
      positionMillis = millis(progress.positionFrames.coerceIn(0L, song.durationFrames)),
      speed = if (progress.playing) PLAYING_SPEED else 0f,
      updatedAt = now,
      actions = SESSION_ACTIONS,
    )

  // The system extrapolates a published position, so a loop wrap or an in-app seek shows only as drift.
  fun stale(published: SongPlayback?, progress: SongProgress, now: Long): Boolean {
    if (published == null) return true
    if ((published.state == PlaybackStateCompat.STATE_PLAYING) != progress.playing) return true
    return abs(published.positionAt(now) - millis(progress.positionFrames)) > DRIFT_TOLERANCE_MILLIS
  }

  fun commandsFor(progress: SongProgress, action: SongAction): List<SongCommand> =
    when (action) {
      SongAction.PLAY -> play(progress)
      SongAction.PAUSE -> if (progress.playing) listOf(SongCommand.Pause) else emptyList()
      SongAction.STOP -> listOf(SongCommand.Stop)
      SongAction.REWIND -> listOf(seek(progress.positionFrames - skipFrames))
      SongAction.FORWARD -> listOf(seek(progress.positionFrames + skipFrames))
    }

  // The engine applies a command on its next audio block, so a read straight after it is stale.
  fun applied(progress: SongProgress, command: SongCommand): SongProgress =
    when (command) {
      SongCommand.Play -> progress.copy(playing = true)
      SongCommand.Pause -> progress.copy(playing = false)
      SongCommand.Stop -> SongProgress(playing = false, positionFrames = 0L)
      is SongCommand.Seek -> progress.copy(positionFrames = command.frame)
    }

  fun seekTo(positionMillis: Long): SongCommand =
    seek((positionMillis * sampleRate / MILLIS_PER_SECOND).roundToLong())

  private fun play(progress: SongProgress): List<SongCommand> =
    when {
      progress.playing -> emptyList()
      progress.positionFrames >= song.restartFromFrame -> listOf(SongCommand.Seek(0L), SongCommand.Play)
      else -> listOf(SongCommand.Play)
    }

  private fun seek(frame: Long): SongCommand = SongCommand.Seek(frame.coerceIn(0L, song.durationFrames))

  private fun millis(frames: Long): Long =
    if (sampleRate <= 0.0) 0L else (frames * MILLIS_PER_SECOND / sampleRate).roundToLong()

  companion object {
    const val DRIFT_TOLERANCE_MILLIS = 300L
    private const val MILLIS_PER_SECOND = 1000.0
    private const val PLAYING_SPEED = 1f
    private const val SESSION_ACTIONS =
      PlaybackStateCompat.ACTION_PLAY or
        PlaybackStateCompat.ACTION_PAUSE or
        PlaybackStateCompat.ACTION_PLAY_PAUSE or
        PlaybackStateCompat.ACTION_STOP or
        PlaybackStateCompat.ACTION_SEEK_TO or
        PlaybackStateCompat.ACTION_REWIND or
        PlaybackStateCompat.ACTION_FAST_FORWARD
  }
}
