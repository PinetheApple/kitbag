#ifdef __ANDROID__

#include <jni.h>

#include <cstdint>
#include <vector>

#include "KitbagJniUtf.h"
#include "analysis/waveform_peaks.h"
#include "kitbag_api.h"
#include "mixer/mixer.h"

using kitbag::JniUtf;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_kitbag_corenative_library_NativeStemBundle_nativeWritePeaks(JNIEnv* env, jobject,
                                                                    jstring path,
                                                                    jint channels,
                                                                    jlong totalFrames,
                                                                    jfloatArray peaks,
                                                                    jint chunkCount) {
  const JniUtf pathUtf(env, path);
  if (pathUtf.get() == nullptr || peaks == nullptr) return JNI_FALSE;
  const auto needed =
      static_cast<int64_t>(chunkCount) * channels * kitbag::kPeakValuesPerChannel;
  if (needed <= 0 || env->GetArrayLength(peaks) < needed) return JNI_FALSE;
  jfloat* elems = env->GetFloatArrayElements(peaks, nullptr);
  if (elems == nullptr) return JNI_FALSE;
  const kb_result result =
      kb_waveform_write_peaks(pathUtf.get(), channels, totalFrames, elems, chunkCount);
  env->ReleaseFloatArrayElements(peaks, elems, JNI_ABORT);
  return result == KB_OK ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jfloatArray JNICALL
Java_com_kitbag_corenative_library_NativeWaveform_nativeReadEnvelope(JNIEnv* env, jobject,
                                                                    jstring path,
                                                                    jint buckets) {
  const JniUtf pathUtf(env, path);
  if (pathUtf.get() == nullptr || buckets <= 0) return nullptr;
  std::vector<float> envelope(static_cast<size_t>(buckets));
  if (kb_waveform_read_envelope(pathUtf.get(), envelope.data(), buckets) != KB_OK) {
    return nullptr;
  }
  jfloatArray out = env->NewFloatArray(buckets);
  if (out == nullptr) return nullptr;
  env->SetFloatArrayRegion(out, 0, buckets, envelope.data());
  return out;
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_library_NativeStemBundle_nativeMaxTracks(JNIEnv*, jobject) {
  return kitbag::Mixer::kMaxTracks;
}

}  // extern "C"

#endif  // __ANDROID__
