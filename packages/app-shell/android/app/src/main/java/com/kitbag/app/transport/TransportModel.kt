package com.kitbag.app.transport

import kotlin.math.roundToInt

enum class Playback { STOPPED, PLAYING, PAUSED }

data class SetlistPosition(
  val setlistName: String,
  val songTitle: String,
  val index: Int,
  val songCount: Int,
) {
  init {
    require(index in 0 until songCount) { "song $index outside a setlist of $songCount" }
  }
}

data class TransportState(
  val playback: Playback,
  val bpm: Double,
  val rampRunning: Boolean,
  val beatsPerBar: Int,
  val beatUnit: Int,
  val setlist: SetlistPosition?,
)

enum class TransportAction { PREVIOUS, TEMPO_DOWN, PLAY, PAUSE, TEMPO_UP, NEXT, STOP }

data class TransportView(
  val title: String,
  val subtitle: String?,
  val actions: List<TransportAction>,
  val compactActions: List<TransportAction>,
)

sealed interface TransportCommand {
  data object Start : TransportCommand

  data object Resume : TransportCommand

  data object Pause : TransportCommand

  data object Stop : TransportCommand

  data class SetTempo(val bpm: Double) : TransportCommand

  data object PreviousSong : TransportCommand

  data object NextSong : TransportCommand
}

class TransportModel(private val minBpm: Double, private val maxBpm: Double) {

  fun view(state: TransportState): TransportView {
    val playPause =
      if (state.playback == Playback.PLAYING) TransportAction.PAUSE else TransportAction.PLAY
    val compact = listOf(TransportAction.TEMPO_DOWN, playPause, TransportAction.TEMPO_UP)
    val actions = buildList {
      if (hasPrevious(state)) add(TransportAction.PREVIOUS)
      addAll(compact)
      if (hasNext(state)) add(TransportAction.NEXT)
      if (state.playback != Playback.STOPPED) add(TransportAction.STOP)
    }
    return TransportView(title(state), subtitle(state), actions, compact)
  }

  fun commandsFor(state: TransportState, action: TransportAction): List<TransportCommand> =
    when (action) {
      TransportAction.PLAY -> play(state.playback)
      TransportAction.PAUSE ->
        if (state.playback == Playback.PLAYING) listOf(TransportCommand.Pause) else emptyList()
      TransportAction.STOP ->
        if (state.playback == Playback.STOPPED) emptyList() else listOf(TransportCommand.Stop)
      TransportAction.TEMPO_DOWN -> stepTempo(state, -TEMPO_STEP_BPM)
      TransportAction.TEMPO_UP -> stepTempo(state, TEMPO_STEP_BPM)
      TransportAction.PREVIOUS ->
        if (hasPrevious(state)) listOf(TransportCommand.PreviousSong) else emptyList()
      TransportAction.NEXT -> if (hasNext(state)) listOf(TransportCommand.NextSong) else emptyList()
    }

  private fun play(playback: Playback): List<TransportCommand> =
    when (playback) {
      Playback.STOPPED -> listOf(TransportCommand.Start)
      Playback.PAUSED -> listOf(TransportCommand.Resume)
      Playback.PLAYING -> emptyList()
    }

  // Matches the screen's tempo keys: step from the rounded effective tempo, and
  // any manual change, even one pinned at a bound, cancels a running ramp.
  private fun stepTempo(state: TransportState, delta: Double): List<TransportCommand> {
    val next = (state.bpm.roundToInt() + delta).coerceIn(minBpm, maxBpm)
    return if (next == state.bpm && !state.rampRunning) emptyList()
    else listOf(TransportCommand.SetTempo(next))
  }

  private fun hasPrevious(state: TransportState): Boolean = (state.setlist?.index ?: 0) > 0

  private fun hasNext(state: TransportState): Boolean =
    state.setlist?.let { it.index < it.songCount - 1 } ?: false

  private fun title(state: TransportState): String =
    "${state.bpm.roundToInt()} BPM · ${state.beatsPerBar}/${state.beatUnit}"

  private fun subtitle(state: TransportState): String? =
    state.setlist?.let { "${it.setlistName} · ${it.songTitle} (${it.index + 1}/${it.songCount})" }

  private companion object {
    const val TEMPO_STEP_BPM = 1.0
  }
}
