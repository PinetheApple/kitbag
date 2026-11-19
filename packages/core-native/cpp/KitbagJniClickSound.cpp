#ifdef __ANDROID__

#include <jni.h>

#include "KitbagCommands.h"
#include "KitbagJniUtf.h"
#include "kitbag_api.h"

using kitbag::JniUtf;

extern "C" {

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_library_NativeClickSound_nativePrepare(JNIEnv* env, jobject,
                                                                 jstring inPath,
                                                                 jstring outPath) {
  const JniUtf in(env, inPath);
  const JniUtf out(env, outPath);
  return static_cast<jint>(kb_click_sound_prepare(in.get(), out.get()));
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_library_NativeClickSound_nativeNoSpace(JNIEnv*, jobject) {
  return static_cast<jint>(KB_ERROR_NO_SPACE);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeLoadCustomSound(JNIEnv* env, jobject,
                                                                     jdouble slot,
                                                                     jstring path) {
  const JniUtf utf(env, path);
  if (utf.get() == nullptr) return static_cast<jint>(KB_ERROR_INVALID_ARGUMENT);
  return static_cast<jint>(kitbag::commandLoadCustomSound(slot, utf.get()));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeClearCustomSound(JNIEnv*, jobject,
                                                                      jdouble slot) {
  kitbag::commandClearCustomSound(slot);
}

JNIEXPORT jboolean JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeCustomSoundLoaded(JNIEnv*, jobject,
                                                                       jdouble slot) {
  return kitbag::commandCustomSoundLoaded(slot) ? JNI_TRUE : JNI_FALSE;
}

}  // extern "C"

#endif  // __ANDROID__
