#include "kitbag_api.h"

#include "analysis/beat_tracker.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <utility>

#include "analysis/onset_envelope.h"

namespace kitbag {

namespace {

constexpr float kMinBpm = 60.0f;
constexpr float kMaxBpm = 200.0f;

// Ellis (2007) tightness over the onset's standard deviation: a half- or double-
// period step costs 48 deviations, so only an outlier onset could pay for one.
constexpr float kTightness = 100.0f;

constexpr int kSmoothingRadius = 2;  // 5-frame moving average

// Equal to KB_MAX_GRID_BEATS by design, and truncation must keep the EARLY
// beats. Both arguments are in SPEC.md §4.3.1 — read it before changing this.
constexpr int kMaxTrackedBeats = KB_MAX_GRID_BEATS;

// Minimum STFT frames before an onset function is worth analysing.
constexpr size_t kMinStftFrames = 10;
// Autocorrelation needs a few periods before the tempo estimate is signal.
constexpr size_t kMinOnsetsForTempo = 20;
// Below this the DP tracker has too few frames to place a beat sequence.
constexpr size_t kMinOnsetsForBeats = 10;
constexpr float kSecondsPerMinute = 60.0f;

// A backtrack shorter than this is noise, not a beat sequence.
constexpr size_t kMinBacktrackedBeats = 3;
// A peak at a whole fraction of the winner's lag this strong relative to it
// means the winner was a slower multiple of the true pulse.
constexpr float kPulseFoldRatio = 0.5f;
// Every multiple of a pulse's lag that fits the BPM window, so equal harmonic
// peaks fold to the fastest one whichever wins by rounding.
constexpr int kMaxPulseFold = static_cast<int>(kMaxBpm / kMinBpm);
// Stands in for the onset's spread when the envelope is flat, so the DP
// transition penalty stays positive instead of collapsing to no penalty.
constexpr float kFallbackOnsetSpread = 0.01f;

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

bool IsInteriorPeak(
    const std::vector<float>& acf,
    int lag,
    int min_lag,
    int max_lag
) {
  return lag > min_lag && lag < max_lag - 1 && acf[lag] > acf[lag - 1] &&
         acf[lag] > acf[lag + 1];
}

int FoldToFastestPulse(
    const std::vector<float>& acf,
    int best_lag,
    int min_lag,
    int max_lag
) {
  for (int fold = kMaxPulseFold; fold > 1; --fold) {
    const int below = best_lag / fold;
    const int lag = acf[below + 1] > acf[below] ? below + 1 : below;
    if (IsInteriorPeak(acf, lag, min_lag, max_lag) &&
        acf[lag] > kPulseFoldRatio * acf[best_lag]) {
      return lag;
    }
  }
  return best_lag;
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
  if (best_lag == 0) return 0;
  return FoldToFastestPulse(acf, best_lag, min_lag, max_lag);
}

struct DpTrellis {
  std::vector<float> score;
  std::vector<int> backlink;
};

// Indexed by gap in frames. Log-ratio, so half and double the period cost alike.
std::vector<float> GapCosts(int period, float period_frames, float weight) {
  std::vector<float> cost(static_cast<size_t>(2 * period) + 1, 0.0f);
  for (size_t gap = 1; gap < cost.size(); ++gap) {
    const float ratio = std::log(static_cast<float>(gap) / period_frames);
    cost[gap] = weight * ratio * ratio;
  }
  return cost;
}

// Phase 3a: forward pass. Each frame's best predecessor is the one whose gap is
// closest to the expected period, weighted against its own accumulated score.
DpTrellis ForwardPass(
    const std::vector<float>& onset,
    int period,
    const std::vector<float>& gap_cost
) {
  const size_t n = onset.size();
  DpTrellis dp{std::vector<float>(n, 0.0f), std::vector<int>(n, -1)};

  for (size_t i = 0; i < n; ++i) {
    const int search_start = std::max(0, static_cast<int>(i) - 2 * period);
    const int search_end = std::max(0, static_cast<int>(i) - period / 2);

    float best_score = 0.0f;
    int best_prev = -1;
    for (int j = search_start; j < search_end && j < static_cast<int>(i); ++j) {
      const float candidate = dp.score[j] - gap_cost[i - j];
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

float TransitionWeight(const std::vector<float>& onset) {
  double sum = 0.0;
  double sum_sq = 0.0;
  for (const float v : onset) {
    sum += v;
    sum_sq += static_cast<double>(v) * v;
  }
  const double n = static_cast<double>(onset.size());
  const double mean = sum / n;
  const auto spread =
      static_cast<float>(std::sqrt(std::max(0.0, sum_sq / n - mean * mean)));
  return kTightness * (spread > 0.0f ? spread : kFallbackOnsetSpread);
}

}  // namespace

BeatResult BeatTracker::AnalyzeFlux(std::vector<float> flux, int sample_rate) {
  BeatResult result;

  const float hop_time = static_cast<float>(kOnsetHopSize) / sample_rate;

  const auto onset = SmoothOnset(std::move(flux));
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

std::vector<float> BeatTracker::SmoothOnset(std::vector<float> flux) {
  if (flux.size() < kMinStftFrames) {
    return {};
  }
  NormalizeByPeak(flux);
  return MovingAverage(flux);
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

  const DpTrellis dp = ForwardPass(
      onset,
      period,
      GapCosts(period, period_frames, TransitionWeight(onset))
  );
  const int last_beat = FinalBeatIndex(dp.score, period);
  return Backtrack(dp.backlink, last_beat, hop_time);
}

}  // namespace kitbag
