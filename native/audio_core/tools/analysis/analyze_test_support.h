#ifndef KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H
#define KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H

// Fixtures and the ABI driver shared by the analyze suite's translation units.
#include "kitbag_api.h"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <numbers>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analyze_buffer_driver.h"
#include "check.h"
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
constexpr float kToneAmp = 0.3f;
constexpr int kToneGuardFrames = 200;
// Above the ~0.02 s beat-tracker drift, far below the 0.45 s one-beat spacing a
// wrong phase or a scaled df-unit conversion would produce.
constexpr float kBarOneToleranceSec = 0.1f;
// Below the ~344 Hz top of the band the downbeat spectral difference reads.
constexpr std::array<float, 5> kBarPitchesHz =
    {110.0f, 164.81f, 130.81f, 196.0f, 146.83f};
constexpr float kTwoPi = 2.0f * std::numbers::pi_v<float>;
constexpr uint32_t kLcgMul = 1664525u;
constexpr uint32_t kLcgInc = 1013904223u;
constexpr float kLcgScale = 1.0f / 2147483648.0f;
constexpr uint32_t kUniformShift = 8;
constexpr uint32_t kUniformMask = 0xFFFFFFu;
constexpr double kUniformScale = 1.0 / (kUniformMask + 1.0);

inline uint32_t LcgStep(uint32_t& state) {
  state = state * kLcgMul + kLcgInc;
  return state;
}

inline float LcgNoise(uint32_t& state) {
  return static_cast<float>(static_cast<int32_t>(LcgStep(state))) * kLcgScale;
}

inline double LcgUniform(uint32_t& state) {
  return static_cast<double>((LcgStep(state) >> kUniformShift) & kUniformMask) *
         kUniformScale;
}

// DownBeat's Hanning window zeroes the click, so the beat-long tone carries the
// spectral cue and the click only gives the tracker an onset.
inline void
AddToneBeat(std::vector<float>& pcm, int beat, float hz, float amp) {
  const size_t start = static_cast<size_t>(beat) * kBeatPeriodFrames;
  for (int s = 0; s < kBeatPeriodFrames - kToneGuardFrames; ++s) {
    const float t = static_cast<float>(s) / static_cast<float>(kSampleRate);
    float v = amp * std::sin(kTwoPi * hz * t);
    if (s < kClickWidth) v += kClickAmp;
    pcm[(start + s) * 2] += v;
    pcm[(start + s) * 2 + 1] += v;
  }
}

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

// One beat per bar differs in pitch; the beat-time grid it is played on.
std::vector<float> MakeStandOutMono(int meter, int phase);
std::vector<float> StandOutGrid();

inline kitbag::DecoderInfo StereoInfo(uint64_t frames, uint32_t channels) {
  kitbag::DecoderInfo info;
  info.channels = channels;
  info.sample_rate = kSampleRate;
  info.total_frames = frames;
  info.duration_seconds = static_cast<double>(frames) / kSampleRate;
  return info;
}

// Pins the KB_OK contract so every caller can read the BeatResult unguarded.
inline kitbag::BeatResult AnalyzePcm(const std::vector<float>& pcm) {
  const uint64_t frames = pcm.size() / 2;
  kitbag::BeatResult result;
  const kb_result status = AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &result
  );
  kitbag_test::Check(status == KB_OK, "analyze: decoded PCM returns KB_OK");
  return result;
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
  double duration_sec = -1.0;
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
      &out->duration_sec,
      waveform_dir
  );
}

inline double FramesToSeconds(uint64_t frames, uint32_t rate) {
  return static_cast<double>(frames) / rate;
}

inline kb_result AnalyzeBytes(
    const std::filesystem::path& file,
    const std::vector<uint8_t>& bytes,
    const char* waveform_dir,
    AbiAnalysis* analysis
) {
  if (!media_test::WriteBytes(file.string(), bytes)) return KB_ERROR_INTERNAL;
  const kb_result status =
      AnalyzeThroughAbi(file.string(), waveform_dir, kAbiCap, analysis);
  std::filesystem::remove(file);
  return status;
}

inline void CheckDamaged(
    const std::filesystem::path& file,
    const std::vector<uint8_t>& bytes,
    const char* message
) {
  AbiAnalysis analysis;
  const kb_result status = AnalyzeBytes(file, bytes, nullptr, &analysis);
  kitbag_test::Check(
      status == KB_ERROR_INVALID_ARGUMENT && analysis.duration_sec == 0.0,
      message
  );
}

inline void CheckIntact(
    const std::filesystem::path& file,
    const std::vector<uint8_t>& bytes,
    double expected_sec,
    const char* message
) {
  AbiAnalysis analysis;
  const kb_result status = AnalyzeBytes(file, bytes, nullptr, &analysis);
  kitbag_test::Check(
      status == KB_OK && analysis.duration_sec == expected_sec,
      message
  );
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_ANALYZE_TEST_SUPPORT_H
