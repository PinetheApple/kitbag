#ifndef KITBAG_JNI_UTF_H
#define KITBAG_JNI_UTF_H

#ifdef __ANDROID__

#include <jni.h>

namespace kitbag {

class JniUtf {
 public:
  JniUtf(JNIEnv* env, jstring str)
      : env_(env), str_(str), utf_(str == nullptr ? nullptr : env->GetStringUTFChars(str, nullptr)) {}
  ~JniUtf() {
    if (utf_ != nullptr) env_->ReleaseStringUTFChars(str_, utf_);
  }
  JniUtf(const JniUtf&) = delete;
  JniUtf& operator=(const JniUtf&) = delete;
  [[nodiscard]] const char* get() const { return utf_; }

 private:
  JNIEnv* env_;
  jstring str_;
  const char* utf_;
};

}  // namespace kitbag

#endif  // __ANDROID__

#endif  // KITBAG_JNI_UTF_H
