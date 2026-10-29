#ifdef __ANDROID__

#include <jni.h>
#include <jsi/jsi.h>

#include <cstdint>
#include <vector>

#include "KitbagCommands.h"
#include "KitbagEngine.h"
#include "KitbagJniUtf.h"
#include "analysis/sidecar_path.h"
#include "kitbag_api.h"

using facebook::jsi::Runtime;
using kitbag::JniUtf;

namespace {

void ThrowNoArgs(JNIEnv* env, const char* className) {
  jclass cls = env->FindClass(className);
  if (cls == nullptr) return;
  jmethodID ctor = env->GetMethodID(cls, "<init>", "()V");
  if (ctor == nullptr) return;
  auto* error = static_cast<jthrowable>(env->NewObject(cls, ctor));
  if (error != nullptr) env->Throw(error);
}

}  // namespace

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
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetRamp(JNIEnv*, jobject, jboolean enabled, jdouble startBpm, jdouble targetBpm, jdouble stepBpm, jdouble interval, jint unit, jboolean loop) {
  kitbag::commandSetRamp(enabled == JNI_TRUE, startBpm, targetBpm, stepBpm, interval, unit, loop == JNI_TRUE);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeSetBarMute(JNIEnv*, jobject, jboolean enabled, jint playBars, jint muteBars) {
  kitbag::commandSetBarMute(enabled == JNI_TRUE, playBars, muteBars);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeLoadTrack(JNIEnv* env, jobject, jint track, jstring path) {
  const JniUtf utf(env, path);
  if (utf.get() == nullptr) return static_cast<jint>(KB_ERROR_INVALID_ARGUMENT);
  return static_cast<jint>(kitbag::commandLoadTrack(track, utf.get()));
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeUnloadTrack(JNIEnv*, jobject, jint track) {
  kitbag::commandUnloadTrack(track);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerSetGain(JNIEnv*, jobject, jint track, jdouble gain) {
  kitbag::commandMixerSetGain(track, gain);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerSetMute(JNIEnv*, jobject, jint track, jboolean muted) {
  kitbag::commandMixerSetMute(track, muted == JNI_TRUE);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerSetSolo(JNIEnv*, jobject, jint track, jboolean soloed) {
  kitbag::commandMixerSetSolo(track, soloed == JNI_TRUE);
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerSetMasterGain(JNIEnv*, jobject, jdouble gain) {
  kitbag::commandMixerSetMasterGain(gain);
}

JNIEXPORT jdouble JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerMasterGain(JNIEnv*, jobject) {
  return kitbag::commandMixerMasterGain();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerPlay(JNIEnv*, jobject) {
  kitbag::commandMixerPlay();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerPause(JNIEnv*, jobject) {
  kitbag::commandMixerPause();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerStop(JNIEnv*, jobject) {
  kitbag::commandMixerStop();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerSeek(JNIEnv*, jobject, jdouble frame) {
  kitbag::commandMixerSeek(frame);
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerSetLoop(JNIEnv*, jobject, jdouble startFrame, jdouble endFrame) {
  return static_cast<jint>(kitbag::commandMixerSetLoop(startFrame, endFrame));
}

JNIEXPORT jint JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeMixerClearLoop(JNIEnv*, jobject) {
  return static_cast<jint>(kitbag::commandMixerClearLoop());
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeClearGrid(JNIEnv*, jobject) {
  kitbag::commandClearGrid();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_KitbagCommandsModule_nativeFollowMixer(JNIEnv*, jobject, jboolean enabled) {
  kitbag::commandFollowMixer(enabled == JNI_TRUE);
}

// --- Tuner -----------------------------------------------------------------

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

// Must not need the JS thread (SPEC §5.8): the service calls these directly.
JNIEXPORT void JNICALL
Java_com_kitbag_corenative_EngineTransport_nativeStart(JNIEnv*, jobject) {
  kitbag::commandStart();
  kitbag::commandMetronomeStartNow();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_EngineTransport_nativePause(JNIEnv*, jobject) {
  kitbag::commandMetronomePause();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_EngineTransport_nativeStop(JNIEnv*, jobject) {
  kitbag::commandMetronomeStop();
}

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_EngineTransport_nativeSetTempo(JNIEnv*, jobject, jdouble bpm) {
  kitbag::commandSetTempo(bpm);
}

JNIEXPORT jdouble JNICALL
Java_com_kitbag_corenative_EngineTransport_nativeCurrentBpm(JNIEnv*, jobject) {
  return kb_metronome_current_bpm(kitbag::kitbagEngine());
}

JNIEXPORT jobject JNICALL
Java_com_kitbag_corenative_library_SongAnalyzer_nativeAnalyzeSong(JNIEnv* env, jobject,
                                                                 jstring path,
                                                                 jstring waveformDir) {
  const JniUtf pathUtf(env, path);
  const JniUtf dirUtf(env, waveformDir);
  if (pathUtf.get() == nullptr || dirUtf.get() == nullptr) return nullptr;

  std::vector<float> beats(KB_MAX_GRID_BEATS);
  std::vector<int32_t> downbeats(KB_MAX_GRID_BEATS);
  float bpm = 0.0F;
  int32_t beatCount = 0;
  int32_t downbeatCount = 0;
  const kb_result result =
      kb_analyze_song(pathUtf.get(), &bpm, beats.data(), KB_MAX_GRID_BEATS, &beatCount,
                      downbeats.data(), &downbeatCount, dirUtf.get());
  if (result == KB_ERROR_INVALID_ARGUMENT) {
    ThrowNoArgs(env, "com/kitbag/corenative/library/UnsupportedAudioException");
    return nullptr;
  }
  if (result != KB_OK) {
    jclass coreError = env->FindClass("com/kitbag/corenative/library/AnalysisCoreException");
    if (coreError == nullptr) return nullptr;
    jmethodID ctor = env->GetMethodID(coreError, "<init>", "(I)V");
    if (ctor == nullptr) return nullptr;
    auto* error = static_cast<jthrowable>(env->NewObject(coreError, ctor, static_cast<jint>(result)));
    if (error != nullptr) env->Throw(error);
    return nullptr;
  }

  jfloatArray beatsOut = env->NewFloatArray(beatCount);
  jintArray downbeatsOut = env->NewIntArray(downbeatCount);
  if (beatsOut == nullptr || downbeatsOut == nullptr) return nullptr;
  env->SetFloatArrayRegion(beatsOut, 0, beatCount, beats.data());
  env->SetIntArrayRegion(downbeatsOut, 0, downbeatCount, downbeats.data());

  jclass analysisClass = env->FindClass("com/kitbag/corenative/library/NativeSongAnalysis");
  if (analysisClass == nullptr) return nullptr;
  jmethodID ctor = env->GetMethodID(analysisClass, "<init>", "(F[F[I)V");
  if (ctor == nullptr) return nullptr;
  return env->NewObject(analysisClass, ctor, static_cast<jfloat>(bpm), beatsOut, downbeatsOut);
}

JNIEXPORT jstring JNICALL
Java_com_kitbag_corenative_library_SongAnalyzer_nativeWaveformPath(JNIEnv* env, jobject,
                                                                  jstring waveformDir,
                                                                  jstring songPath) {
  const JniUtf dirUtf(env, waveformDir);
  const JniUtf songUtf(env, songPath);
  if (dirUtf.get() == nullptr || songUtf.get() == nullptr) return nullptr;
  return env->NewStringUTF(kitbag::SidecarPath(dirUtf.get(), songUtf.get()).c_str());
}

}  // extern "C"

#endif  // __ANDROID__
