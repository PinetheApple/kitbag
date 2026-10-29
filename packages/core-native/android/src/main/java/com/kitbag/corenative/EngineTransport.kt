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

  fun mixerPlay() = nativeMixerPlay()

  fun mixerPause() = nativeMixerPause()

  fun mixerStop() = nativeMixerStop()

  fun mixerSeek(frame: Long) = nativeMixerSeek(frame.toDouble())

  fun mixerPosition(): Long = nativeMixerPosition().toLong()

  fun mixerPlaying(): Boolean = nativeMixerPlaying()

  fun sampleRate(): Double = nativeSampleRate()

  private external fun nativeStart()
  private external fun nativePause()
  private external fun nativeStop()
  private external fun nativeSetTempo(bpm: Double)
  private external fun nativeCurrentBpm(): Double
  private external fun nativeMixerPlay()
  private external fun nativeMixerPause()
  private external fun nativeMixerStop()
  private external fun nativeMixerSeek(frame: Double)
  private external fun nativeMixerPosition(): Double
  private external fun nativeMixerPlaying(): Boolean
  private external fun nativeSampleRate(): Double
}
