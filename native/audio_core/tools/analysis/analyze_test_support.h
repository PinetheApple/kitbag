#ifndef KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H
#define KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H

// Fixtures and the ABI driver shared by the analyze suite's translation units.
#include "kitbag_api.h"

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "media/decoder.h"
#include "wav_fixture.h"

namespace analyze_test {

constexpr uint32_t kSampleRate = 44100;
// 132 BPM at 44100 Hz. Not a round frame count, so a wrong period cannot land
// on the same integer as the right one.
constexpr int kBeatPeriodFrames = 20045;
constexpr int kBeatCount = 12;
constexpr int kClickWidth = 64;
constexpr float kClickAmp = 0.8f;
// Comfortably above any beat count these fixtures produce, so a full-cap run
// truncates nothing.
constexpr int kAbiCap = 64;

// One narrow impulse burst per beat, stereo interleaved. Spectral flux fires on
// each onset, so autocorrelation has a real period to lock to.
inline std::vector<float> MakeClickTrack() {
  const int total = (kBeatCount + 1) * kBeatPeriodFrames;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  for (int b = 0; b < kBeatCount; ++b) {
    const int start = b * kBeatPeriodFrames;
    for (int s = 0; s < kClickWidth && start + s < total; ++s) {
      pcm[static_cast<size_t>(start + s) * 2] = kClickAmp;
      pcm[static_cast<size_t>(start + s) * 2 + 1] = kClickAmp;
    }
  }
  return pcm;
}

// The downbeat suite's per-bar tone fixture; accented=false is its control.
std::vector<float> MakeBarToneTrack(bool accented);

inline kitbag::DecoderInfo StereoInfo(uint64_t frames, uint32_t channels) {
  kitbag::DecoderInfo info;
  info.channels = channels;
  info.sample_rate = kSampleRate;
  info.total_frames = frames;
  info.duration_seconds = static_cast<double>(frames) / kSampleRate;
  return info;
}

// `data` holds the int16 peaks actually present after the header, so a short
// file reads back short rather than padded.
struct Sidecar {
  char magic[4] = {0, 0, 0, 0};
  uint32_t version = 0;
  uint32_t channels = 0;
  int64_t total_frames = 0;
  uint32_t chunk_count = 0;
  std::vector<int16_t> data;
};

inline bool ReadSidecar(const std::string& path, Sidecar* out) {
  std::FILE* f = std::fopen(path.c_str(), "rb");
  if (f == nullptr) return false;
  bool ok = std::fread(out->magic, 1, 4, f) == 4;
  ok = ok && std::fread(&out->version, sizeof(out->version), 1, f) == 1;
  ok = ok && std::fread(&out->channels, sizeof(out->channels), 1, f) == 1;
  ok = ok &&
       std::fread(&out->total_frames, sizeof(out->total_frames), 1, f) == 1;
  ok = ok && std::fread(&out->chunk_count, sizeof(out->chunk_count), 1, f) == 1;
  out->data.resize(static_cast<size_t>(out->chunk_count) * out->channels * 2);
  out->data.resize(
      std::fread(out->data.data(), sizeof(int16_t), out->data.size(), f)
  );
  std::fclose(f);
  return ok;
}

struct AbiAnalysis {
  float bpm = -1.0f;
  int32_t beat_count = -1;
  int32_t downbeat_count = -1;
  std::vector<float> beats;
  std::vector<int32_t> downbeats;
};

// Runs the full C ABI with both caller-out buffers sized to cap. The beat and
// downbeat buffers share cap, matching the contract that downbeat_indices_out
// is sized to beat_times_cap.
inline kb_result AnalyzeThroughAbi(
    const std::string& wav,
    const char* waveform_dir,
    int cap,
    AbiAnalysis* out
) {
  out->beats.assign(cap, 0.0f);
  out->downbeats.assign(cap, 0);
  return kb_analyze_song(
      wav.c_str(),
      &out->bpm,
      out->beats.data(),
      cap,
      &out->beat_count,
      out->downbeats.data(),
      &out->downbeat_count,
      waveform_dir
  );
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H
