#ifdef __ANDROID__

#include <jni.h>

#include "KitbagCommands.h"
#include "KitbagEngine.h"
#include "KitbagJniUtf.h"
#include "kitbag_api.h"

using kitbag::JniUtf;

extern "C" {

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_library_MixdownExport_nativeStart(JNIEnv* env, jobject, jstring path) {
  const JniUtf utf(env, path);
  if (utf.get() == nullptr) return static_cast<jint>(KB_ERROR_INVALID_ARGUMENT);
  return static_cast<jint>(kitbag::commandMixdownStart(utf.get()));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_library_MixdownExport_nativeCancel(JNIEnv*, jobject) {
  kitbag::commandMixdownCancel();
}

JNIEXPORT jboolean JNICALL
Java_com_kitbag_corenative_library_MixdownExport_nativeRunning(JNIEnv*, jobject) {
  const bool running = kb_mixdown_current_state(kitbag::kitbagEngine()) == KB_MIXDOWN_STATE_RUNNING;
  return running ? JNI_TRUE : JNI_FALSE;
}

}  // extern "C"

#endif  // __ANDROID__
