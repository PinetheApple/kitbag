#ifdef __ANDROID__

#include <jni.h>

#include "KitbagCommands.h"

extern "C" {

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetBeats(JNIEnv*, jobject, jint beatsPerBar, jint denominator) {
  kitbag::commandSetBeats(beatsPerBar, denominator);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSubdivision(JNIEnv*, jobject, jint subdivision) {
  kitbag::commandSetSubdivision(subdivision);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetSubdivisionAccents(JNIEnv*, jobject, jint subdivision, jint slotMask) {
  kitbag::commandSetSubdivisionAccents(subdivision, slotMask);
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
