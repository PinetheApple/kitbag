package com.kitbag.corenative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

/**
 * SKELETON — staged for #33 (on-device). Compiles against the codegen'd spec, but
 * the runtime behaviour (JSI install under bridgeless, engine lifecycle) is NOT
 * yet verified on a device.
 *
 * The Android implementation of the KitbagCommands TurboModule (SPEC §13.2). It
 * does two jobs:
 *
 *  1. Command routing. Each method below forwards to a JNI entrypoint in
 *     libkitbag_jsi.so (KitbagJni.cpp), which calls kitbag::command* against the
 *     single process-wide engine (SPEC §4.5). This module never holds an engine
 *     pointer of its own.
 *
 *  2. HostObject install on the RN JS runtime. The constructor grabs the JS
 *     runtime pointer and calls nativeInstall -> kitbag::kitbagInstall (creates
 *     the ONE g_engine + installs the JSI HostObject on this runtime's global).
 *     The 60fps worklet reads on the SEPARATE Reanimated UI runtime; the split,
 *     and why it is handled this way, are documented in bootstrapRuntime.ts
 *     (+ runbook §1).
 *
 * This class extends `NativeKitbagCommandsSpec`, generated from
 * src/NativeKitbagCommands.ts by React Native codegen (the `com.facebook.react`
 * Gradle plugin, applied in this module's android/build.gradle). Codegen emits
 * every parameter as a `double` and every Promise as a trailing argument; the
 * overrides below match that generated Java spec exactly (verified against the
 * generated NativeKitbagCommandsSpec.java, not the TS types).
 *
 * UNVERIFIED: `reactContext.javaScriptContextHolder` returning a live JSI runtime
 * pointer under bridgeless New Arch is what the device build confirms (it may need
 * a RuntimeExecutor hop instead; see runbook §1).
 */
class KitbagCommandsModule(reactContext: ReactApplicationContext) :
  NativeKitbagCommandsSpec(reactContext) {

  init {
    // Install the HostObject + create the single engine on the RN JS runtime.
    // javaScriptContextHolder.get() is the JSI runtime pointer; it is valid by
    // the time JS first resolves this TurboModule (getKitbagCommands()), which is
    // when this constructor runs. UNVERIFIED under bridgeless — see class doc.
    val runtimePtr = reactContext.javaScriptContextHolder?.get() ?: 0L
    if (runtimePtr != 0L) {
      nativeInstall(runtimePtr)
    }
  }

  // getName() is provided by the generated spec (returns NAME); not overridden.

  // --- Transport -----------------------------------------------------------

  override fun start(promise: Promise) {
    promise.resolve(nativeStart())
  }

  override fun stop() {
    nativeStop()
  }

  override fun metronomeStart(anchorFrame: Double) {
    nativeMetronomeStart(anchorFrame)
  }

  // --- Tempo & grid --------------------------------------------------------

  override fun setTempo(bpm: Double) {
    nativeSetTempo(bpm)
  }

  override fun setGrid(beatTimesSec: ReadableArray, anchorFrame: Double, promise: Promise) {
    val count = beatTimesSec.size()
    val times = DoubleArray(count) { i -> beatTimesSec.getDouble(i) }
    promise.resolve(nativeSetGrid(times, anchorFrame))
  }

  // --- Metronome setters ---------------------------------------------------

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

  override fun setSound(soundIndex: Double) {
    nativeSetSound(soundIndex.toInt())
  }

  override fun setVolume(volume: Double) {
    nativeSetVolume(volume)
  }

  override fun setLatencyOffset(latencyMs: Double) {
    nativeSetLatencyOffset(latencyMs)
  }

  // --- Mixer ---------------------------------------------------------------

  override fun loadTrack(track: Double, path: String, promise: Promise) {
    promise.resolve(nativeLoadTrack(track.toInt(), path))
  }

  // --- JNI (libkitbag_jsi.so / KitbagJni.cpp) ------------------------------

  private external fun nativeInstall(runtimePtr: Long)
  private external fun nativeStart(): Int
  private external fun nativeStop()
  private external fun nativeMetronomeStart(anchorFrame: Double)
  private external fun nativeSetTempo(bpm: Double)
  private external fun nativeSetGrid(beatTimesSec: DoubleArray, anchorFrame: Double): Int
  private external fun nativeSetBeats(beatsPerBar: Int, denominator: Int)
  private external fun nativeSetSubdivision(subdivision: Int)
  private external fun nativeSetAccent(beatIndex: Int, accent: Int)
  private external fun nativeSetPoly(enabled: Boolean, beats: Int)
  private external fun nativeSetSound(soundIndex: Int)
  private external fun nativeSetVolume(volume: Double)
  private external fun nativeSetLatencyOffset(latencyMs: Double)
  private external fun nativeLoadTrack(track: Int, path: String): Int

  companion object {
    init {
      // The CMake target `kitbag_jsi` -> libkitbag_jsi.so, carrying both the JSI
      // glue and the JNI bridge (KitbagJni.cpp).
      System.loadLibrary("kitbag_jsi")
    }
  }
}
