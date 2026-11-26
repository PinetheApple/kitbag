#ifdef __ANDROID__

#include <jni.h>

#include "KitbagCommands.h"
#include "kitbag_api.h"

extern "C" {

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetBeats(JNIEnv*, jobject, jint beatsPerBar, jint denominator) {
  kitbag::commandSetBeats(beatsPerBar, denominator);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMetronomeSelectSlot(JNIEnv*, jobject, jint slot) {
  kitbag::commandMetronomeSelectSlot(slot);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMetronomeAnchorExternal(JNIEnv*, jobject, jdouble songPosSec, jdouble atFrame, jdouble bpm) {
  kitbag::commandMetronomeAnchorExternal(songPosSec, atFrame, bpm);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSubdivision(JNIEnv*, jobject, jint subdivision) {
  kitbag::commandSetSubdivision(subdivision);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSubdivisionAccents(JNIEnv*, jobject, jint subdivision, jint slotMask) {
  kitbag::commandSetSubdivisionAccents(subdivision, slotMask);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetGridGrouping(JNIEnv* env, jobject, jintArray sizes) {
  const jsize count = env->GetArrayLength(sizes);
  jint* elems = env->GetIntArrayElements(sizes, nullptr);
  if (elems == nullptr) return static_cast<jint>(KB_ERROR_INTERNAL);
  const int32_t result = kitbag::commandSetGridGrouping(elems, static_cast<int32_t>(count));
  env->ReleaseIntArrayElements(sizes, elems, JNI_ABORT);
  return static_cast<jint>(result);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetGridRate(JNIEnv*, jobject, jint rate) {
  return static_cast<jint>(kitbag::commandSetGridRate(rate));
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
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetPolyAgainst(JNIEnv*, jobject, jint mainBeats) {
  kitbag::commandSetPolyAgainst(mainBeats);
}

}  // extern "C"

#endif  // __ANDROID__
