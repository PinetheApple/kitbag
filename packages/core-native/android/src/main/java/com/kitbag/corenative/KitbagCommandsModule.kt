package com.kitbag.corenative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

// Codegen emits every numeric parameter as Double; each override narrows to the
// JNI type the C ABI takes.
class KitbagCommandsModule(reactContext: ReactApplicationContext) :
  NativeKitbagCommandsSpec(reactContext) {

  init {
    val runtimePtr = reactContext.javaScriptContextHolder?.get() ?: 0L
    if (runtimePtr != 0L) {
      nativeInstall(runtimePtr)
    }
  }

  override fun start(promise: Promise) {
    promise.resolve(nativeStart())
  }

  override fun stop() {
    nativeStop()
  }

  override fun metronomeStart(anchorFrame: Double) {
    nativeMetronomeStart(anchorFrame)
  }

  override fun metronomeStop() {
    nativeMetronomeStop()
  }

  override fun metronomePause() {
    nativeMetronomePause()
  }

  override fun setTempo(bpm: Double) {
    nativeSetTempo(bpm)
  }

  override fun setGrid(beatTimesSec: ReadableArray, anchorFrame: Double, promise: Promise) {
    val count = beatTimesSec.size()
    val times = DoubleArray(count) { i -> beatTimesSec.getDouble(i) }
    promise.resolve(nativeSetGrid(times, anchorFrame))
  }

  override fun setBeats(beatsPerBar: Double, denominator: Double) {
    nativeSetBeats(beatsPerBar.toInt(), denominator.toInt())
  }

  override fun setSubdivision(subdivision: Double) {
    nativeSetSubdivision(subdivision.toInt())
  }

  override fun setAccent(beatIndex: Double, accent: Double) {
    nativeSetAccent(beatIndex.toInt(), accent.toInt())
  }

  override fun setPoly(enabled: Boolean, beats: Double) {
    nativeSetPoly(enabled, beats.toInt())
  }

  override fun setPolyAccent(beatIndex: Double, accent: Double) {
    nativeSetPolyAccent(beatIndex.toInt(), accent.toInt())
  }

  override fun setSounds(normalSound: Double, accentSound: Double) {
    nativeSetSounds(normalSound.toInt(), accentSound.toInt())
  }

  override fun previewSound(sound: Double, accented: Boolean) {
    nativePreviewSound(sound.toInt(), accented)
  }

  override fun setCountIn(bars: Double, distinct: Boolean, sound: Double) {
    nativeSetCountIn(bars.toInt(), distinct, sound.toInt())
  }

  override fun setVolume(volume: Double) {
    nativeSetVolume(volume)
  }

  override fun setLatencyOffset(latencyMs: Double) {
    nativeSetLatencyOffset(latencyMs)
  }

  override fun setRamp(
    enabled: Boolean,
    startBpm: Double,
    endBpm: Double,
    duration: Double,
    unit: Double,
    loop: Boolean,
  ) {
    nativeSetRamp(enabled, startBpm, endBpm, duration, unit.toInt(), loop)
  }

  override fun setBarMute(enabled: Boolean, playBars: Double, muteBars: Double) {
    nativeSetBarMute(enabled, playBars.toInt(), muteBars.toInt())
  }

  override fun loadTrack(track: Double, path: String, promise: Promise) {
    promise.resolve(nativeLoadTrack(track.toInt(), path))
  }

  private external fun nativeInstall(runtimePtr: Long)
  private external fun nativeStart(): Int
  private external fun nativeStop()
  private external fun nativeMetronomeStart(anchorFrame: Double)
  private external fun nativeMetronomeStop()
  private external fun nativeMetronomePause()
  private external fun nativeSetTempo(bpm: Double)
  private external fun nativeSetGrid(beatTimesSec: DoubleArray, anchorFrame: Double): Int
  private external fun nativeSetBeats(beatsPerBar: Int, denominator: Int)
  private external fun nativeSetSubdivision(subdivision: Int)
  private external fun nativeSetAccent(beatIndex: Int, accent: Int)
  private external fun nativeSetPoly(enabled: Boolean, beats: Int)
  private external fun nativeSetPolyAccent(beatIndex: Int, accent: Int)
  private external fun nativeSetSounds(normalSound: Int, accentSound: Int)
  private external fun nativePreviewSound(sound: Int, accented: Boolean)
  private external fun nativeSetCountIn(bars: Int, distinct: Boolean, sound: Int)
  private external fun nativeSetVolume(volume: Double)
  private external fun nativeSetLatencyOffset(latencyMs: Double)
  private external fun nativeSetRamp(
    enabled: Boolean,
    startBpm: Double,
    endBpm: Double,
    duration: Double,
    unit: Int,
    loop: Boolean,
  )
  private external fun nativeSetBarMute(enabled: Boolean, playBars: Int, muteBars: Int)
  private external fun nativeLoadTrack(track: Int, path: String): Int

  companion object {
    init {
      System.loadLibrary("kitbag_jsi")
    }
  }
}
