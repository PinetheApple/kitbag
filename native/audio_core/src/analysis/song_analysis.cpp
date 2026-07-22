// The offline analysis pipeline behind kb_analyze_song. App thread only —
// nothing here runs on the audio callback, so it may allocate.
#include "analysis/song_analysis.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <string>

#include "analysis/downbeat.h"
#include "analysis/sidecar_path.h"
#include "analysis/waveform_peaks.h"

namespace kitbag {

namespace {

bool AllFinite(const float* pcm, uint64_t count) {
  for (uint64_t i = 0; i < count; ++i) {
    if (!std::isfinite(pcm[i])) return false;
  }
  return true;
}

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
// total_frames(int64), chunk_count(uint32), data(int16[]).
void WritePeaks(std::FILE* f, const WaveformPeaks& peaks) {
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
    int total_frames,
    int channels
) {
  if (waveform_dir == nullptr || channels == 0) {
    return;
  }
  const auto peaks =
      ComputeWaveformPeaks(pcm, total_frames, channels, kWaveformTargetChunks);
  if (peaks.data.empty()) {
    return;
  }

  const std::string kwav_path = SidecarPath(waveform_dir, path);
  std::FILE* f = std::fopen(kwav_path.c_str(), "wb");
  if (f == nullptr) {
    return;
  }
  WritePeaks(f, peaks);
  std::fclose(f);
}

}  // namespace

bool NarrowFrames(uint64_t frames, int* out) {
  if (frames > static_cast<uint64_t>(std::numeric_limits<int>::max())) {
    return false;
  }
  *out = static_cast<int>(frames);
  return true;
}

kb_result AnalyzeDecodedPcm(
    const float* pcm,
    uint64_t total_frames,
    const DecoderInfo& info,
    const char* path,
    const char* waveform_dir,
    BeatResult* out
) {
  int frame_count = 0;
  int channels = 0;
  if (info.channels == 0 || !NarrowFrames(total_frames, &frame_count) ||
      !NarrowFrames(info.channels, &channels)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  if (!AllFinite(pcm, total_frames * info.channels)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }

  const auto mono = DownmixToMono(pcm, total_frames, info.channels);
  const int rate = static_cast<int>(info.sample_rate);
  BeatTracker tracker;
  *out = tracker.Analyze(mono.data(), frame_count, rate);
  out->downbeat_indices =
      FindDownbeats(mono.data(), frame_count, rate, out->beat_times, 0);

  WriteWaveformSidecar(path, waveform_dir, pcm, frame_count, channels);
  return KB_OK;
}

}  // namespace kitbag
