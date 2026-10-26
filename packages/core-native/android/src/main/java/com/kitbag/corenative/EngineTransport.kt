package com.kitbag.corenative

internal object EngineTransport {
  init {
    System.loadLibrary("kitbag_jsi")
  }

  fun start() = nativeStart()

  fun pause() = nativePause()

  fun stop() = nativeStop()

  fun setTempo(bpm: Double) = nativeSetTempo(bpm)

  fun currentBpm(): Double = nativeCurrentBpm()

  private external fun nativeStart()
  private external fun nativePause()
  private external fun nativeStop()
  private external fun nativeSetTempo(bpm: Double)
  private external fun nativeCurrentBpm(): Double
}
