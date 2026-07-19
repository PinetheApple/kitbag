// Offline song analysis: decode, downmix, beat-track, write the waveform
// sidecar. App thread only — nothing here runs on the audio callback.
#include "kitbag_api.h"

#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <vector>

#include "beat_tracker.h"
#include "decoder.h"
#include "sidecar_path.h"
#include "waveform_peaks.h"

namespace {

// Peak buckets across the whole file — the scrubber's horizontal resolution.
constexpr int kWaveformTargetChunks = 2000;

std::vector<float>
DownmixToMono(const float* pcm, uint64_t total_frames, uint32_t channels) {
  std::vector<float> mono(total_frames);
  for (uint64_t f = 0; f < total_frames; ++f) {
    float sum = 0.0f;
    for (uint32_t ch = 0; ch < channels; ++ch) {
      sum += pcm[f * channels + ch];
    }
    mono[f] = sum / static_cast<float>(channels);
  }
  return mono;
}

// Layout: magic "KWAV" (4 bytes), version(uint32), channels(uint32),
// total_frames(int64), chunk_count(uint32), data(int16[]). Not evident here.
void WritePeaks(std::FILE* f, const kitbag::WaveformPeaks& peaks) {
  const uint32_t version = 1;
  const auto channels_u32 = static_cast<uint32_t>(peaks.channels);
  const int64_t total = peaks.total_frames;
  const auto chunks = static_cast<uint32_t>(peaks.chunk_count);
  std::fwrite("KWAV", 1, 4, f);
  std::fwrite(&version, sizeof(version), 1, f);
  std::fwrite(&channels_u32, sizeof(channels_u32), 1, f);
  std::fwrite(&total, sizeof(total), 1, f);
  std::fwrite(&chunks, sizeof(chunks), 1, f);
  std::fwrite(peaks.data.data(), sizeof(int16_t), peaks.data.size(), f);
}

void WriteWaveformSidecar(
    const char* path,
    const char* waveform_dir,
    const float* pcm,
    uint64_t total_frames,
    uint32_t channels
) {
  const auto peaks = kitbag::ComputeWaveformPeaks(
      pcm,
      static_cast<int>(total_frames),
      static_cast<int>(channels),
      kWaveformTargetChunks
  );
  if (peaks.data.empty()) {
    return;
  }

  const std::string kwav_path = kitbag::SidecarPath(waveform_dir, path);
  std::FILE* f = std::fopen(kwav_path.c_str(), "wb");
  if (f == nullptr) {
    return;
  }
  WritePeaks(f, peaks);
  std::fclose(f);
}

void MaybeWriteSidecar(
    const char* path,
    const char* dir,
    const std::vector<float>& pcm,
    uint64_t frames,
    uint32_t channels
) {
  if (dir == nullptr || channels == 0) return;
  WriteWaveformSidecar(path, dir, pcm.data(), frames, channels);
}

int CopyBeatTimes(const std::vector<float>& beats, float* out, int32_t cap) {
  const int to_copy = std::min(static_cast<int>(beats.size()), cap);
  for (int i = 0; i < to_copy; ++i) {
    out[i] = beats[i];
  }
  return to_copy;
}

// Decode, downmix, beat-track, and emit the sidecar. Leaves the ABI shim with
// nothing but argument checks and copying results out.
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

  const auto mono = DownmixToMono(pcm.data(), total_frames, info.channels);
  kitbag::BeatTracker tracker;
  *out = tracker.Analyze(
      mono.data(),
      static_cast<int>(total_frames),
      static_cast<int>(info.sample_rate)
  );

  MaybeWriteSidecar(path, waveform_dir, pcm, total_frames, info.channels);
  return KB_OK;
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
