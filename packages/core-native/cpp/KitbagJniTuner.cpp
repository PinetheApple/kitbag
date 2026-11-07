#ifdef __ANDROID__

#include <jni.h>

#include <cstdint>

#include "KitbagCommands.h"

extern "C" {

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerStart(JNIEnv*, jobject) {
  return static_cast<jint>(kitbag::commandTunerStart());
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerStop(JNIEnv*, jobject) {
  kitbag::commandTunerStop();
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerSetTuning(JNIEnv* env, jobject,
                                                              jint instrument,
                                                              jintArray stringMidis) {
  jint* elems =
      stringMidis == nullptr ? nullptr : env->GetIntArrayElements(stringMidis, nullptr);
  if (elems == nullptr) {
    return static_cast<jint>(kitbag::commandTunerSetTuning(instrument, nullptr, 0));
  }
  // jint is int32_t on Android, so the array is the ABI's `const int32_t*` as-is.
  const jsize count = env->GetArrayLength(stringMidis);
  const int32_t result = kitbag::commandTunerSetTuning(
      static_cast<int32_t>(instrument), elems, static_cast<int32_t>(count));
  env->ReleaseIntArrayElements(stringMidis, elems, JNI_ABORT);
  return static_cast<jint>(result);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerSetTargetString(JNIEnv*, jobject,
                                                                    jint stringIndex) {
  return static_cast<jint>(
      kitbag::commandTunerSetTargetString(static_cast<int32_t>(stringIndex)));
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerSetChromatic(JNIEnv*, jobject) {
  return static_cast<jint>(kitbag::commandTunerSetChromatic());
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerSetA4(JNIEnv*, jobject,
                                                          jdouble a4Hz) {
  return static_cast<jint>(kitbag::commandTunerSetA4(static_cast<double>(a4Hz)));
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeTunerResetNotePresence(JNIEnv*, jobject,
                                                                      jdouble pauseMs) {
  return static_cast<jint>(
      kitbag::commandTunerResetNotePresence(static_cast<double>(pauseMs)));
}

}  // extern "C"

#endif  // __ANDROID__
