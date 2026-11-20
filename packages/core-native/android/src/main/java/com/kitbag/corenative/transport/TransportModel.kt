package com.kitbag.corenative.transport

import kotlin.math.roundToInt

enum class Playback { STOPPED, PLAYING, PAUSED }

fun playbackOf(playing: Boolean, stopped: Boolean): Playback =
  when {
    playing -> Playback.PLAYING
    stopped -> Playback.STOPPED
    else -> Playback.PAUSED
  }

data class TransportState(
  val playback: Playback,
  val bpm: Double,
  val rampRunning: Boolean,
  val beatsPerBar: Int,
  val beatUnit: Int,
  val subtitle: String?,
)

data class TransportChange(
  val state: TransportState,
  val practice: PracticeClock,
  val cardNumber: Int,
  val action: TransportAction,
  val tempoStep: Int,
  val engineBpm: Double,
)

enum class TransportAction {
  TEMPO_DOWN,
  PLAY,
  PAUSE,
  TEMPO_UP,
  STOP;

  companion object {
    fun named(name: String): TransportAction? = entries.find { it.name == name }
  }
}

data class TransportView(
  val title: String,
  val subtitle: String?,
  val actions: List<TransportAction>,
)

sealed interface TransportCommand {
  data object Start : TransportCommand

  data object Resume : TransportCommand

  data object Pause : TransportCommand

  data object Stop : TransportCommand

  data class SetTempo(val bpm: Double) : TransportCommand
}

class TransportModel(private val minBpm: Double, private val maxBpm: Double) {

  fun view(state: TransportState): TransportView {
    val playPause =
      if (state.playback == Playback.PLAYING) TransportAction.PAUSE else TransportAction.PLAY
    val actions = buildList {
      addAll(listOf(TransportAction.TEMPO_DOWN, playPause, TransportAction.TEMPO_UP))
      if (state.playback != Playback.STOPPED) add(TransportAction.STOP)
    }
    return TransportView(title(state), state.subtitle, actions)
  }

  fun commandsFor(state: TransportState, action: TransportAction): List<TransportCommand> =
    when (action) {
      TransportAction.PLAY -> play(state.playback)
      TransportAction.PAUSE ->
        if (state.playback == Playback.PLAYING) listOf(TransportCommand.Pause) else emptyList()
      TransportAction.STOP ->
        if (state.playback == Playback.STOPPED) emptyList() else listOf(TransportCommand.Stop)
      TransportAction.TEMPO_DOWN, TransportAction.TEMPO_UP -> stepTempo(state, tempoStep(action))
    }

  // A card shown stopped stays up through its tempo keys; only Stop ends it.
  fun endsCard(action: TransportAction, next: TransportState): Boolean =
    action == TransportAction.STOP && next.playback == Playback.STOPPED

  fun tempoStep(action: TransportAction): Int =
    when (action) {
      TransportAction.TEMPO_DOWN -> -TEMPO_STEP_BPM
      TransportAction.TEMPO_UP -> TEMPO_STEP_BPM
      else -> 0
    }

  private fun play(playback: Playback): List<TransportCommand> =
    when (playback) {
      Playback.STOPPED -> listOf(TransportCommand.Start)
      Playback.PAUSED -> listOf(TransportCommand.Resume)
      Playback.PLAYING -> emptyList()
    }

  // Matches the screen's tempo keys: step from the rounded effective tempo, and
  // any manual change, even one pinned at a bound, cancels a running ramp.
  private fun stepTempo(state: TransportState, delta: Int): List<TransportCommand> {
    val next = (state.bpm.roundToInt() + delta).toDouble().coerceIn(minBpm, maxBpm)
    return if (next == state.bpm && !state.rampRunning) emptyList()
    else listOf(TransportCommand.SetTempo(next))
  }

  private fun title(state: TransportState): String =
    "${state.bpm.roundToInt()} BPM · ${state.beatsPerBar}/${state.beatUnit}"

  private companion object {
    const val TEMPO_STEP_BPM = 1
  }
}
