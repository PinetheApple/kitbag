package com.kitbag.corenative.library

sealed interface AnalysedTempo {
  data object Unsteady : AnalysedTempo

  data class Steady(val bpm: Double, val anchorSec: Double, val beatsPerBar: Int) : AnalysedTempo
}
