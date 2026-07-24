package com.kitbag.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

/**
 * SKELETON — staged for #33 (on-device), NOT verified here.
 *
 * The Android implementation of the KitbagCommands TurboModule (SPEC §13.2). It
 * does two jobs, and both are load-bearing for the #33 gate:
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
 * BUILD-TIME RESOLUTION (§13.2): this class extends the codegen'd abstract spec
 * `NativeKitbagCommandsSpec`, generated from packages/core-native/src/
 * NativeKitbagCommands.ts during the Gradle `codegen` task. That class does not
 * exist in the tree — it is emitted under the react-native codegen output package
 * (conventionally `com.facebook.fbreact.specs`) only when a build runs. The exact
 * generated method signatures (in particular whether Int32 params surface as
 * `Int` or `Double`, and the Promise arg placement) are codegen-owned; if the
 * first device build reports an override mismatch, align the overrides below with
 * the generated `NativeKitbagCommandsSpec` — do NOT change the TS spec to match a
 * guess here. The signatures below follow the New Architecture Kotlin codegen
 * convention for RN 0.83.
 *
 * UNVERIFIED: nothing in this file has compiled — the generated superclass does
 * not exist off-build, and `reactContext.javaScriptContextHolder` returning a
 * live JSI runtime pointer under bridgeless New Arch is exactly what the device
 * build confirms (it may need a RuntimeExecutor hop instead; see runbook §1).
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

  override fun getName(): String = NAME

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

  override fun setBeats(beatsPerBar: Double) {
    nativeSetBeats(beatsPerBar.toInt())
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
  private external fun nativeSetBeats(beatsPerBar: Int)
  private external fun nativeSetSubdivision(subdivision: Int)
  private external fun nativeSetAccent(beatIndex: Int, accent: Int)
  private external fun nativeSetPoly(enabled: Boolean, beats: Int)
  private external fun nativeSetSound(soundIndex: Int)
  private external fun nativeSetVolume(volume: Double)
  private external fun nativeSetLatencyOffset(latencyMs: Double)
  private external fun nativeLoadTrack(track: Int, path: String): Int

  companion object {
    // Matches TurboModuleRegistry.getEnforcing<Spec>('KitbagCommands') on the JS
    // side (NativeKitbagCommands.ts). One owner of the module name string.
    const val NAME = "KitbagCommands"

    init {
      // The CMake target `kitbag_jsi` -> libkitbag_jsi.so, carrying both the JSI
      // glue and the JNI bridge (KitbagJni.cpp).
      System.loadLibrary("kitbag_jsi")
    }
  }
}
