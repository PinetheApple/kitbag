package com.kitbag.corenative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap

object ConstantTempoFitter {
  private const val RESULT = 0
  private const val BPM = 1
  private const val ANCHOR_SEC = 2
  private const val BEATS_PER_BAR = 3

  fun fit(beatTimesSec: ReadableArray, downbeatIndices: ReadableArray): WritableMap {
    val beats = FloatArray(beatTimesSec.size()) { i -> beatTimesSec.getDouble(i).toFloat() }
    val downbeats = IntArray(downbeatIndices.size()) { i -> downbeatIndices.getInt(i) }
    val fit = nativeFit(beats, downbeats)
    return Arguments.createMap().apply {
      putInt("result", fit[RESULT].toInt())
      putDouble("bpm", fit[BPM])
      putDouble("anchorSec", fit[ANCHOR_SEC])
      putInt("beatsPerBar", fit[BEATS_PER_BAR].toInt())
    }
  }

  private external fun nativeFit(beatTimesSec: FloatArray, downbeatIndices: IntArray): DoubleArray

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
