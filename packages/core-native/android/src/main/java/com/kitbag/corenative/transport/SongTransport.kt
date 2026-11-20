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
)

data class SongCardTag(val cardNumber: Int, val session: Int, val followsPlayOrder: Boolean, val order: SongOrder)

// SystemUI formats the artist into "%1$s by %2$s", so a null would read as "null".
fun mediaArtist(artist: String?): String = if (artist.isNullOrBlank()) "" else artist

const val UNITY_PLAYBACK_RATE = 1f

data class SongProgress(
  val playing: Boolean,
  val positionFrames: Long,
  val countingIn: Boolean = false,
  val rate: Float = UNITY_PLAYBACK_RATE,
) {
  val shownPlaying: Boolean
    get() = playing || countingIn

  fun shown(playing: Boolean, countingIn: Boolean): SongProgress =
    if (countingIn) copy(countingIn = true) else copy(playing = playing, countingIn = false)
}

enum class SongAction {
  REWIND,
  PLAY,
  PAUSE,
  FORWARD,
  STOP,
  PREVIOUS,
  NEXT;

  companion object {
    fun named(name: String): SongAction? = entries.find { it.name == name }
  }
}

sealed interface SongCommand {
  data object Play : SongCommand

  data object Pause : SongCommand

  data object Stop : SongCommand

  data object StopCountIn : SongCommand

  data class Seek(val frame: Long) : SongCommand

  data object Next : SongCommand

  data object Previous : SongCommand
}

val SongCommand.appAction: String
  get() =
    when (this) {
      SongCommand.Play -> "play"
      SongCommand.Pause -> "pause"
      SongCommand.Stop, SongCommand.StopCountIn -> "stop"
      is SongCommand.Seek -> "seek"
      SongCommand.Next -> "next"
      SongCommand.Previous -> "previous"
    }

data class SongRoute(val app: SongCommand?, val engine: List<SongCommand>)

val SongCommand.endsSong: Boolean
  get() = this == SongCommand.Stop || this == SongCommand.StopCountIn

enum class SongOrder {
  ALONE,
  UP_NEXT,
  LAST;

  companion object {
    fun of(previous: Boolean, next: Boolean): SongOrder =
      when {
        next -> UP_NEXT
        previous -> LAST
        else -> ALONE
      }

    fun named(name: String?): SongOrder = entries.find { it.name == name } ?: ALONE
  }
}

data class SongSlots(val actions: List<SongAction>, val compact: List<Int>, val reserveNext: Boolean)

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

  // The system card fills an absent Previous or Next slot with the next custom action unless it is reserved.
  fun slots(progress: SongProgress, order: SongOrder): SongSlots {
    val playPause = if (progress.shownPlaying) SongAction.PAUSE else SongAction.PLAY
    val skips = listOf(SongAction.REWIND, SongAction.FORWARD)
    val actions =
      when (order) {
        SongOrder.ALONE -> listOf(SongAction.REWIND, playPause, SongAction.FORWARD, SongAction.STOP)
        SongOrder.UP_NEXT -> listOf(SongAction.PREVIOUS, playPause, SongAction.NEXT) + skips
        SongOrder.LAST -> listOf(SongAction.PREVIOUS, playPause) + skips
      }
    val compact =
      if (order == SongOrder.ALONE) actions.indices.take(MAX_COMPACT_ACTIONS)
      else actions.indices.filter { actions[it] in ORDER_KEYS }
    return SongSlots(actions, compact, reserveNext = order == SongOrder.LAST)
  }

  fun playback(progress: SongProgress, order: SongOrder, now: Long): SongPlayback =
    SongPlayback(
      state = if (progress.shownPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
      positionMillis = millis(progress.positionFrames.coerceIn(0L, song.durationFrames)),
      speed = if (progress.playing) progress.rate else 0f,
      updatedAt = now,
      actions = SESSION_ACTIONS or skipActions(order),
    )

  // The system extrapolates a published position, so a loop wrap or an in-app seek shows only as drift.
  fun stale(published: SongPlayback?, progress: SongProgress, now: Long): Boolean {
    if (published == null) return true
    if ((published.state == PlaybackStateCompat.STATE_PLAYING) != progress.shownPlaying) return true
    if (progress.playing && published.speed != progress.rate) return true
    return abs(published.positionAt(now) - millis(progress.positionFrames)) > DRIFT_TOLERANCE_MILLIS
  }

  fun commandsFor(progress: SongProgress, action: SongAction): List<SongCommand> =
    when (action) {
      SongAction.PLAY -> play(progress)
      SongAction.PAUSE -> if (progress.playing) listOf(SongCommand.Pause) else emptyList()
      SongAction.STOP -> listOf(SongCommand.Stop)
      SongAction.REWIND -> listOf(seek(progress.positionFrames - skipFrames))
      SongAction.FORWARD -> listOf(seek(progress.positionFrames + skipFrames))
      SongAction.PREVIOUS -> listOf(seek(0L))
      SongAction.NEXT -> emptyList()
    }

  // A count-in is the app's to cancel; Stop also ends the count and the card natively, as after the start.
  fun route(progress: SongProgress, action: SongAction, appListening: Boolean): SongRoute {
    if (action == SongAction.NEXT) return SongRoute(if (appListening) SongCommand.Next else null, emptyList())
    if (action == SongAction.PREVIOUS && appListening) return SongRoute(SongCommand.Previous, emptyList())
    if (progress.countingIn && action == SongAction.STOP) {
      return SongRoute(if (appListening) SongCommand.Stop else null, listOf(SongCommand.StopCountIn))
    }
    if (!progress.countingIn || !appListening) return SongRoute(null, commandsFor(progress, action))
    return SongRoute(appCommand(progress, action), emptyList())
  }

  fun seekRoute(progress: SongProgress, positionMillis: Long, appListening: Boolean): SongRoute {
    val command = seekTo(positionMillis)
    return if (progress.countingIn && appListening) SongRoute(command, emptyList()) else SongRoute(null, listOf(command))
  }

  // The engine applies a command on its next audio block, so a read straight after it is stale.
  fun applied(progress: SongProgress, command: SongCommand): SongProgress =
    when (command) {
      SongCommand.Play -> progress.copy(playing = true)
      SongCommand.Pause -> progress.copy(playing = false)
      SongCommand.Stop, SongCommand.StopCountIn -> SongProgress(playing = false, positionFrames = 0L)
      is SongCommand.Seek -> progress.copy(positionFrames = command.frame)
      SongCommand.Next, SongCommand.Previous -> progress
    }

  fun seekedInApp(progress: SongProgress, frame: Long): SongProgress = applied(progress, seek(frame))

  fun seekTo(positionMillis: Long): SongCommand =
    seek((positionMillis * sampleRate / MILLIS_PER_SECOND).roundToLong())

  private fun appCommand(progress: SongProgress, action: SongAction): SongCommand =
    when (action) {
      SongAction.PLAY -> SongCommand.Play
      SongAction.PAUSE -> SongCommand.Pause
      SongAction.STOP -> SongCommand.Stop
      SongAction.REWIND -> seek(progress.positionFrames - skipFrames)
      SongAction.FORWARD -> seek(progress.positionFrames + skipFrames)
      SongAction.PREVIOUS -> SongCommand.Previous
      SongAction.NEXT -> SongCommand.Next
    }

  private fun play(progress: SongProgress): List<SongCommand> =
    when {
      progress.playing -> emptyList()
      progress.positionFrames >= song.restartFromFrame -> listOf(SongCommand.Seek(0L), SongCommand.Play)
      else -> listOf(SongCommand.Play)
    }

  private fun seek(frame: Long): SongCommand = SongCommand.Seek(frame.coerceIn(0L, song.durationFrames))

  private fun millis(frames: Long): Long =
    if (sampleRate <= 0.0) 0L else (frames * MILLIS_PER_SECOND / sampleRate).roundToLong()

  private fun skipActions(order: SongOrder): Long =
    when (order) {
      SongOrder.ALONE -> 0L
      SongOrder.UP_NEXT ->
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
      SongOrder.LAST -> PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
    }

  companion object {
    const val DRIFT_TOLERANCE_MILLIS = 300L
    private const val MAX_COMPACT_ACTIONS = 3
    private val ORDER_KEYS = setOf(SongAction.PREVIOUS, SongAction.PLAY, SongAction.PAUSE, SongAction.NEXT)
    private const val MILLIS_PER_SECOND = 1000.0
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
