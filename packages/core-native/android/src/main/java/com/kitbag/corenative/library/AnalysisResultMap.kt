package com.kitbag.corenative.library

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

fun AnalysisResult.toMap(): WritableMap =
  Arguments.createMap().apply {
    putString("relativePath", relativePath)
    putBoolean("ok", ok)
    putString("error", error)
    putDouble("bpm", bpm.toDouble())
    putArray("beats", Arguments.createArray().apply { beats.forEach { pushDouble(it.toDouble()) } })
    putArray("downbeats", Arguments.createArray().apply { downbeats.forEach { pushInt(it) } })
    putString("waveformRelativePath", waveformRelativePath)
    putDouble("durationSec", durationSec)
    analysisVersion?.let { putInt("analysisVersion", it) }
  }
