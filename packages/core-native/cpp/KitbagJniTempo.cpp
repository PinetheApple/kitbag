#ifdef __ANDROID__

#include <jni.h>

#include <cstdint>

#include "kitbag_api.h"

namespace {

constexpr jsize kFitFields = 4;

jdoubleArray FitArray(JNIEnv* env, kb_result result, float bpm, double anchor, int32_t per_bar) {
  const jdouble fields[kFitFields] = {static_cast<jdouble>(result), bpm, anchor,
                                      static_cast<jdouble>(per_bar)};
  jdoubleArray out = env->NewDoubleArray(kFitFields);
  if (out != nullptr) env->SetDoubleArrayRegion(out, 0, kFitFields, fields);
  return out;
}

}  // namespace

extern "C" {

JNIEXPORT jdoubleArray JNICALL
Java_com_kitbag_corenative_ConstantTempoFitter_nativeFit(JNIEnv* env, jobject, jfloatArray beatTimesSec,
                                                         jintArray downbeatIndices) {
  float bpm = 0.0f;
  double anchor = 0.0;
  int32_t perBar = 0;
  jfloat* beats = env->GetFloatArrayElements(beatTimesSec, nullptr);
  jint* downbeats = env->GetIntArrayElements(downbeatIndices, nullptr);
  const kb_result result = kb_fit_constant_tempo(
      beats, env->GetArrayLength(beatTimesSec), downbeats, env->GetArrayLength(downbeatIndices), &bpm,
      &anchor, &perBar);
  env->ReleaseIntArrayElements(downbeatIndices, downbeats, JNI_ABORT);
  env->ReleaseFloatArrayElements(beatTimesSec, beats, JNI_ABORT);
  return FitArray(env, result, bpm, anchor, perBar);
}

}  // extern "C"

#endif  // __ANDROID__
