#include "kitbag_api.h"

#include "beat_tracker.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

#include "fft.h"

namespace kitbag {

namespace {

// Independent of sample rate.
constexpr int kFftSize = 2048;
constexpr int kHopSize = 512;

constexpr float kMinBpm = 60.0f;
constexpr float kMaxBpm = 200.0f;

constexpr float kTransitionPenalty = 0.02f;

constexpr int kSmoothingRadius = 2;  // 5-frame moving average

// Equal to KB_MAX_GRID_BEATS by design, and truncation must keep the EARLY
// beats. Both arguments are in SPEC.md §4.3.1 — read it before changing this.
constexpr int kMaxTrackedBeats = KB_MAX_GRID_BEATS;

// Minimum STFT frames before an onset function is worth analysing.
constexpr int kMinStftFrames = 10;
// Autocorrelation needs a few periods before the tempo estimate is signal.
constexpr size_t kMinOnsetsForTempo = 20;
// Below this the DP tracker has too few frames to place a beat sequence.
constexpr size_t kMinOnsetsForBeats = 10;
constexpr float kSecondsPerMinute = 60.0f;

// A backtrack shorter than this is noise, not a beat sequence.
constexpr size_t kMinBacktrackedBeats = 3;
// A half-lag peak this strong relative to the winner means the winner was
// half-time: the true pulse is twice as fast.
constexpr float kHalfTimeRatio = 0.5f;
// Stands in for the mean onset strength when the envelope is all zeros, so the
// DP transition penalty stays positive instead of collapsing to no penalty.
constexpr float kFallbackMeanOnset = 0.01f;

void WindowFrame(
    const float* pcm,
    int num_frames,
    int offset,
    const std::vector<float>& window,
    std::vector<float>& out
) {
  for (int i = 0; i < kFftSize; ++i) {
    const int idx = offset + i;
    out[2 * i] = idx < num_frames ? pcm[idx] * window[i] : 0.0f;
    out[2 * i + 1] = 0.0f;
  }
}

void Magnitudes(const std::vector<float>& fft_buf, std::vector<float>& out) {
  for (size_t i = 0; i < out.size(); ++i) {
    const float re = fft_buf[2 * i];
    const float im = fft_buf[2 * i + 1];
    out[i] = std::sqrt(re * re + im * im);
  }
}

float SpectralFlux(
    const std::vector<float>& mag,
    const std::vector<float>& prev_mag
) {
  float flux = 0.0f;
  for (size_t i = 0; i < mag.size(); ++i) {
    const float diff = mag[i] - prev_mag[i];
    if (diff > 0.0f) {
      flux += diff;
    }
  }
  return flux / static_cast<float>(mag.size());
}

// Phase 1: half-wave-rectified spectral flux, one value per STFT hop.
std::vector<float>
FluxEnvelope(const float* pcm, int num_frames, int num_stft_frames) {
  std::vector<float> window(kFftSize);
  fft_hann(window.data(), kFftSize);

  std::vector<float> fft_buf(2 * kFftSize);
  const int num_bins = kFftSize / 2 + 1;
  std::vector<float> mag(num_bins);
  std::vector<float> prev_mag(num_bins, 0.0f);
  std::vector<float> onset(num_stft_frames);

  for (int f = 0; f < num_stft_frames; ++f) {
    WindowFrame(pcm, num_frames, f * kHopSize, window, fft_buf);
    fft(fft_buf.data(), kFftSize, false);
    Magnitudes(fft_buf, mag);
    onset[f] = SpectralFlux(mag, prev_mag);
    prev_mag = mag;
  }
  return onset;
}

void NormalizeByPeak(std::vector<float>& onset) {
  float max_val = 0.0f;
  for (const float v : onset) {
    if (v > max_val) max_val = v;
  }
  if (max_val > 0.0f) {
    for (float& v : onset) v /= max_val;
  }
}

std::vector<float> MovingAverage(const std::vector<float>& onset) {
  std::vector<float> smoothed(onset.size(), 0.0f);
  for (size_t f = 0; f < onset.size(); ++f) {
    float sum = 0.0f;
    int count = 0;
    for (int d = -kSmoothingRadius; d <= kSmoothingRadius; ++d) {
      const int idx = static_cast<int>(f) + d;
      if (idx >= 0 && idx < static_cast<int>(onset.size())) {
        sum += onset[idx];
        ++count;
      }
    }
    smoothed[f] = sum / count;
  }
  return smoothed;
}

std::vector<float>
Autocorrelation(const std::vector<float>& onset, int min_lag, int max_lag) {
  const size_t n = onset.size();
  std::vector<float> acf(max_lag, 0.0f);
  for (int lag = min_lag; lag < max_lag; ++lag) {
    float sum = 0.0f;
    int count = 0;
    for (size_t i = 0; i + static_cast<size_t>(lag) < n; ++i) {
      sum += onset[i] * onset[i + lag];
      ++count;
    }
    if (count > 0) {
      acf[lag] = sum / count;
    }
  }
  return acf;
}

// Strongest local maximum, so a broad shoulder does not outrank a true peak.
int BestPeakLag(const std::vector<float>& acf, int min_lag, int max_lag) {
  float max_acf = 0.0f;
  int best_lag = 0;
  for (int lag = min_lag; lag < max_lag; ++lag) {
    bool is_peak = true;
    if (lag > min_lag && lag < max_lag - 1) {
      is_peak = acf[lag] > acf[lag - 1] && acf[lag] > acf[lag + 1];
    }
    if (is_peak && acf[lag] > max_acf) {
      max_acf = acf[lag];
      best_lag = lag;
    }
  }
  if (best_lag >= min_lag * 2 && best_lag / 2 >= min_lag &&
      acf[best_lag / 2] > kHalfTimeRatio * max_acf) {
    best_lag /= 2;
  }
  return best_lag;
}

struct DpTrellis {
  std::vector<float> score;
  std::vector<int> backlink;
};

// Phase 3a: forward pass. Each frame's best predecessor is the one whose gap is
// closest to the expected period, weighted against its own accumulated score.
DpTrellis ForwardPass(
    const std::vector<float>& onset,
    int period,
    float period_frames,
    float penalty
) {
  const size_t n = onset.size();
  DpTrellis dp{std::vector<float>(n, 0.0f), std::vector<int>(n, -1)};

  for (size_t i = 0; i < n; ++i) {
    const int search_start = std::max(0, static_cast<int>(i) - 2 * period);
    const int search_end = std::max(0, static_cast<int>(i) - period / 2);

    float best_score = 0.0f;
    int best_prev = -1;
    for (int j = search_start; j < search_end && j < static_cast<int>(i); ++j) {
      const float gap = static_cast<float>(i - j);
      const float deviation = (gap - period_frames) / period_frames;
      const float candidate = dp.score[j] - penalty * deviation * deviation;
      if (candidate > best_score) {
        best_score = candidate;
        best_prev = j;
      }
    }
    dp.score[i] = onset[i] + best_score;
    dp.backlink[i] = best_prev;
  }
  return dp;
}

int FinalBeatIndex(const std::vector<float>& score, int period) {
  const size_t n = score.size();
  int last_beat = static_cast<int>(n) - 1;
  float max_score = 0.0f;
  const size_t search_start = n > static_cast<size_t>(period) ? n - period : 0;
  for (size_t i = search_start; i < n; ++i) {
    if (score[i] > max_score) {
      max_score = score[i];
      last_beat = static_cast<int>(i);
    }
  }
  return last_beat;
}

// Phase 3b: walk the backlinks and reverse. The walk is backward, so any cap
// must be applied AFTER reversing — see SPEC.md §4.3.1.
std::vector<float>
Backtrack(const std::vector<int>& backlink, int last_beat, float hop_time) {
  std::vector<float> reversed;
  for (int b = last_beat; b >= 0; b = backlink[b]) {
    reversed.push_back(static_cast<float>(b) * hop_time);
  }
  if (reversed.size() < kMinBacktrackedBeats) return {};

  std::vector<float> beats(reversed.rbegin(), reversed.rend());
  if (beats.size() > static_cast<size_t>(kMaxTrackedBeats)) {
    beats.resize(kMaxTrackedBeats);
  }
  return beats;
}

float TransitionPenalty(const std::vector<float>& onset) {
  float sum_onset = 0.0f;
  for (const float v : onset) sum_onset += v;
  const float mean_onset = sum_onset / onset.size();
  return kTransitionPenalty *
         (mean_onset > 0.0f ? mean_onset : kFallbackMeanOnset);
}

}  // namespace

BeatResult
BeatTracker::Analyze(const float* pcm, int num_frames, int sample_rate) {
  BeatResult result;

  const float hop_time = static_cast<float>(kHopSize) / sample_rate;

  const auto onset = ComputeOnsetFunction(pcm, num_frames);
  if (onset.empty()) {
    return result;
  }

  result.bpm = EstimateTempo(onset, hop_time);
  if (result.bpm < kMinBpm) {
    return result;
  }

  result.beat_times = TrackBeats(onset, hop_time, result.bpm);
  return result;
}

std::vector<float>
BeatTracker::ComputeOnsetFunction(const float* pcm, int num_frames) {
  const int num_stft_frames =
      std::max(0, (num_frames - kFftSize) / kHopSize) + 1;
  if (num_stft_frames < kMinStftFrames) {
    return {};
  }

  auto onset = FluxEnvelope(pcm, num_frames, num_stft_frames);
  NormalizeByPeak(onset);
  return MovingAverage(onset);
}

float BeatTracker::EstimateTempo(
    const std::vector<float>& onset,
    float hop_time
) {
  if (onset.size() < kMinOnsetsForTempo) return 0.0f;

  const int min_lag =
      static_cast<int>(kSecondsPerMinute / (kMaxBpm * hop_time));
  const int max_lag =
      static_cast<int>(kSecondsPerMinute / (kMinBpm * hop_time)) + 1;
  if (min_lag >= max_lag || min_lag < 1) return 0.0f;

  const auto acf = Autocorrelation(onset, min_lag, max_lag);
  const int best_lag = BestPeakLag(acf, min_lag, max_lag);
  if (best_lag <= 0) return 0.0f;

  return kSecondsPerMinute / (static_cast<float>(best_lag) * hop_time);
}

std::vector<float> BeatTracker::TrackBeats(
    const std::vector<float>& onset,
    float hop_time,
    float bpm
) {
  if (onset.size() < kMinOnsetsForBeats || bpm <= 0.0f) return {};

  const float period_frames = kSecondsPerMinute / (bpm * hop_time);
  const int period = static_cast<int>(std::round(period_frames));
  if (period < 2) return {};

  const DpTrellis dp =
      ForwardPass(onset, period, period_frames, TransitionPenalty(onset));
  const int last_beat = FinalBeatIndex(dp.score, period);
  return Backtrack(dp.backlink, last_beat, hop_time);
}

}  // namespace kitbag
