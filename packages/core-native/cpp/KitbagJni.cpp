// JNI bridge for the Android KitbagCommands TurboModule + the JSI HostObject
// install (SKELETON, staged for #33 — going live on device, NOT verified here).
//
// This is Android-only glue: it wraps the pure-C++ install/command entrypoints
// (KitbagEngine.cpp / KitbagCommands.cpp) so the Kotlin TurboModule
// (core-native KitbagCommandsModule.kt) can reach them by JNI. iOS never compiles
// this file — the whole translation unit is #ifdef __ANDROID__, so the podspec's
// `cpp/*.cpp` glob picks it up but it is empty off Android (iOS install path is a
// separate #33 concern, needs a Mac).
//
// SPEC §4.5 single-engine invariant is preserved: nativeInstall routes to
// kitbag::kitbagInstall (creates the ONE g_engine + installs the HostObject on
// the given runtime); every command routes through kitbag::command* which borrow
// that same engine via kitbagEngine(). No engine is created here and no second
// pointer is held.
//
// The JNI symbol names below are the JVM mangling of
//   com.kitbag.corenative.KitbagCommandsModule.<external fun>
// (package `.` -> `_`), resolved by System.loadLibrary("kitbag_jsi") +
// dynamic linking. None of this is exercised until a Gradle build + device.

#ifdef __ANDROID__

#include <jni.h>
#include <jsi/jsi.h>

#include <cstdint>

#include "KitbagCommands.h"
#include "KitbagEngine.h"

using facebook::jsi::Runtime;

extern "C" {

// Install the HostObject + create the single engine on the runtime whose pointer
// the Kotlin side hands us. This entrypoint is runtime-agnostic — it installs on
// whatever runtime pointer it is given; the caller chooses the runtime. Why the
// choice matters (the two-runtimes mechanism) is documented once in
// bootstrapRuntime.ts. This JNI call is only ever handed the RN JS runtime.
JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeInstall(JNIEnv* /*env*/,
                                                       jobject /*self*/,
                                                       jlong runtimePtr) {
  auto* rt = reinterpret_cast<Runtime*>(runtimePtr);
  if (rt == nullptr) {
    return;
  }
  kitbag::kitbagInstall(*rt);
}

// --- Transport -------------------------------------------------------------

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeStart(JNIEnv*, jobject) {
  return static_cast<jint>(kitbag::commandStart());
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeStop(JNIEnv*, jobject) {
  kitbag::commandStop();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMetronomeStart(JNIEnv*, jobject,
                                                              jdouble anchorFrame) {
  kitbag::commandMetronomeStart(static_cast<double>(anchorFrame));
}

// --- Tempo & grid ----------------------------------------------------------

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetTempo(JNIEnv*, jobject,
                                                        jdouble bpm) {
  kitbag::commandSetTempo(static_cast<double>(bpm));
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetGrid(JNIEnv* env, jobject,
                                                       jdoubleArray beatTimesSec,
                                                       jdouble anchorFrame) {
  if (beatTimesSec == nullptr) {
    return static_cast<jint>(kitbag::commandSetGrid(nullptr, 0, anchorFrame));
  }
  const jsize count = env->GetArrayLength(beatTimesSec);
  // jdouble is a plain IEEE double, so the storage is layout-compatible with the
  // C ABI's `const double*`. Copy out (JNI_ABORT frees without copyback since the
  // engine only reads).
  jdouble* elems = env->GetDoubleArrayElements(beatTimesSec, nullptr);
  const int32_t result = kitbag::commandSetGrid(
      static_cast<const double*>(elems), static_cast<int32_t>(count),
      static_cast<double>(anchorFrame));
  env->ReleaseDoubleArrayElements(beatTimesSec, elems, JNI_ABORT);
  return static_cast<jint>(result);
}

// --- Metronome setters -----------------------------------------------------

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetBeats(JNIEnv*, jobject,
                                                        jint beatsPerBar,
                                                        jint denominator) {
  // The engine owns denominator validation (kitbag_api.h); none duplicated here.
  kitbag::commandSetBeats(static_cast<int32_t>(beatsPerBar),
                          static_cast<int32_t>(denominator));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSubdivision(JNIEnv*, jobject,
                                                              jint subdivision) {
  kitbag::commandSetSubdivision(static_cast<int32_t>(subdivision));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetAccent(JNIEnv*, jobject,
                                                         jint beatIndex,
                                                         jint accent) {
  kitbag::commandSetAccent(static_cast<int32_t>(beatIndex),
                           static_cast<int32_t>(accent));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetPoly(JNIEnv*, jobject,
                                                       jboolean enabled,
                                                       jint beats) {
  kitbag::commandSetPoly(enabled == JNI_TRUE, static_cast<int32_t>(beats));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSound(JNIEnv*, jobject,
                                                        jint soundIndex) {
  kitbag::commandSetSound(static_cast<int32_t>(soundIndex));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetVolume(JNIEnv*, jobject,
                                                         jdouble volume) {
  kitbag::commandSetVolume(static_cast<double>(volume));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetLatencyOffset(JNIEnv*, jobject,
                                                                jdouble latencyMs) {
  kitbag::commandSetLatencyOffset(static_cast<double>(latencyMs));
}

// --- Mixer -----------------------------------------------------------------

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeLoadTrack(JNIEnv* env, jobject,
                                                         jint track,
                                                         jstring path) {
  const char* utf = env->GetStringUTFChars(path, nullptr);
  const int32_t result =
      kitbag::commandLoadTrack(static_cast<int32_t>(track), utf);
  env->ReleaseStringUTFChars(path, utf);
  return static_cast<jint>(result);
}

}  // extern "C"

#endif  // __ANDROID__
