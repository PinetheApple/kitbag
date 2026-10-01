#ifdef __ANDROID__

#include <jni.h>
#include <jsi/jsi.h>

#include <cstdint>

#include "KitbagCommands.h"
#include "KitbagEngine.h"

using facebook::jsi::Runtime;

extern "C" {


JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeInstall(JNIEnv*, jobject, jlong runtimePtr) {
  auto* rt = reinterpret_cast<Runtime*>(runtimePtr);
  if (rt == nullptr) return;
  kitbag::kitbagInstall(*rt);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeStart(JNIEnv*, jobject) {
  return static_cast<jint>(kitbag::commandStart());
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeStop(JNIEnv*, jobject) {
  kitbag::commandStop();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMetronomeStart(JNIEnv*, jobject, jdouble anchorFrame) {
  kitbag::commandMetronomeStart(anchorFrame);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMetronomeStop(JNIEnv*, jobject) {
  kitbag::commandMetronomeStop();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMetronomePause(JNIEnv*, jobject) {
  kitbag::commandMetronomePause();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetTempo(JNIEnv*, jobject, jdouble bpm) {
  kitbag::commandSetTempo(bpm);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetGrid(JNIEnv* env, jobject, jdoubleArray beatTimesSec, jdouble anchorFrame) {
  if (beatTimesSec == nullptr) {
    return static_cast<jint>(kitbag::commandSetGrid(nullptr, 0, anchorFrame));
  }
  const jsize count = env->GetArrayLength(beatTimesSec);
  jdouble* elems = env->GetDoubleArrayElements(beatTimesSec, nullptr);
  const int32_t result = kitbag::commandSetGrid(elems, static_cast<int32_t>(count), anchorFrame);
  env->ReleaseDoubleArrayElements(beatTimesSec, elems, JNI_ABORT);
  return static_cast<jint>(result);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetBeats(JNIEnv*, jobject, jint beatsPerBar, jint denominator) {
  kitbag::commandSetBeats(beatsPerBar, denominator);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSubdivision(JNIEnv*, jobject, jint subdivision) {
  kitbag::commandSetSubdivision(subdivision);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetAccent(JNIEnv*, jobject, jint beatIndex, jint accent) {
  kitbag::commandSetAccent(beatIndex, accent);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetPoly(JNIEnv*, jobject, jboolean enabled, jint beats) {
  kitbag::commandSetPoly(enabled == JNI_TRUE, beats);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetPolyAccent(JNIEnv*, jobject, jint beatIndex, jint accent) {
  kitbag::commandSetPolyAccent(beatIndex, accent);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSounds(JNIEnv*, jobject, jint normalSound, jint accentSound) {
  kitbag::commandSetSounds(normalSound, accentSound);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativePreviewSound(JNIEnv*, jobject, jint sound, jboolean accented) {
  kitbag::commandPreviewSound(sound, accented == JNI_TRUE);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetCountIn(JNIEnv*, jobject, jint bars, jboolean distinct, jint sound) {
  kitbag::commandSetCountIn(bars, distinct == JNI_TRUE, sound);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetVolume(JNIEnv*, jobject, jdouble volume) {
  kitbag::commandSetVolume(volume);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetLatencyOffset(JNIEnv*, jobject, jdouble latencyMs) {
  kitbag::commandSetLatencyOffset(latencyMs);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetRamp(JNIEnv*, jobject, jboolean enabled, jdouble startBpm, jdouble endBpm, jdouble duration, jint unit, jboolean loop) {
  kitbag::commandSetRamp(enabled == JNI_TRUE, startBpm, endBpm, duration, unit, loop == JNI_TRUE);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetBarMute(JNIEnv*, jobject, jboolean enabled, jint playBars, jint muteBars) {
  kitbag::commandSetBarMute(enabled == JNI_TRUE, playBars, muteBars);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeLoadTrack(JNIEnv* env, jobject, jint track, jstring path) {
  const char* utf = env->GetStringUTFChars(path, nullptr);
  const int32_t result = kitbag::commandLoadTrack(track, utf);
  env->ReleaseStringUTFChars(path, utf);
  return static_cast<jint>(result);
}

}  // extern "C"

#endif  // __ANDROID__
