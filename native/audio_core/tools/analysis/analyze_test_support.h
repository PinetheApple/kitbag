#ifndef KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H
#define KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H

// Fixtures and the ABI driver shared by the analyze suite's translation units.
#include "kitbag_api.h"

#include <cstdint>
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

inline kitbag::DecoderInfo StereoInfo(uint64_t frames, uint32_t channels) {
  kitbag::DecoderInfo info;
  info.channels = channels;
  info.sample_rate = kSampleRate;
  info.total_frames = frames;
  info.duration_seconds = static_cast<double>(frames) / kSampleRate;
  return info;
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
