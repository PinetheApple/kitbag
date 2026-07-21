// ABI shim for offline song analysis: open, decode, hand off to the pipeline,
// copy results out. App thread only — nothing here runs on the audio callback.
#include "kitbag_api.h"

#include <algorithm>
#include <cstdint>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/song_analysis.h"
#include "media/decoder.h"

namespace {

int CopyBeatTimes(const std::vector<float>& beats, float* out, int32_t cap) {
  const int to_copy = std::min(static_cast<int>(beats.size()), cap);
  for (int i = 0; i < to_copy; ++i) {
    out[i] = beats[i];
  }
  return to_copy;
}

kb_result AnalyzeFile(
    const char* path,
    const char* waveform_dir,
    kitbag::BeatResult* out
) {
  kitbag::Decoder decoder;
  if (!decoder.Open(path)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  const auto info = decoder.info();

  uint64_t total_frames = 0;
  const auto pcm = decoder.DecodeAll(&total_frames);
  decoder.Close();
  if (pcm.empty() || total_frames == 0) {
    return KB_OK;
  }
  return kitbag::AnalyzeDecodedPcm(
      pcm.data(),
      total_frames,
      info,
      path,
      waveform_dir,
      out
  );
}

}  // namespace

extern "C" {

kb_result kb_analyze_song(
    const char* path,
    float* bpm_out,
    float* beat_times_buf,
    int32_t beat_times_cap,
    int32_t* beat_count_out,
    const char* waveform_dir
) {
  if (path == nullptr || bpm_out == nullptr || beat_times_buf == nullptr ||
      beat_count_out == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }

  *bpm_out = 0.0f;
  *beat_count_out = 0;

  kitbag::BeatResult result;
  const kb_result status = AnalyzeFile(path, waveform_dir, &result);
  if (status != KB_OK) {
    return status;
  }

  *bpm_out = result.bpm;
  *beat_count_out =
      CopyBeatTimes(result.beat_times, beat_times_buf, beat_times_cap);
  return KB_OK;
}

}  // extern "C"
