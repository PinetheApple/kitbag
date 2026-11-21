package com.kitbag.corenative.library

import androidx.annotation.Keep

@Keep
class NativeSongAnalysis(
  val bpm: Float,
  val beats: FloatArray,
  val downbeats: IntArray,
  val durationSec: Double,
  val analysisVersion: Int,
  tempoFitted: Boolean,
  tempoBpm: Float,
  tempoAnchorSec: Double,
  tempoBeatsPerBar: Int,
) {
  val tempo: AnalysedTempo =
    if (tempoFitted) AnalysedTempo.Steady(tempoBpm.toDouble(), tempoAnchorSec, tempoBeatsPerBar) else AnalysedTempo.Unsteady
}
