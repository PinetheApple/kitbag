#include "beat_tracker.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

#include "fft.h"

namespace kitbag {

namespace {

// STFT parameters — independent of sample rate
constexpr int kFftSize = 2048;
constexpr int kHopSize = 512;

// Tempo range in BPM
constexpr float kMinBpm = 60.0f;
constexpr float kMaxBpm = 200.0f;

// DP beat tracking penalty weight
constexpr float kTransitionPenalty = 0.02f;

// Minimum STFT frames before an onset function is worth analysing.
constexpr int kMinStftFrames = 10;
// Autocorrelation needs a few periods before the tempo estimate is signal.
constexpr size_t kMinOnsetsForTempo = 20;
// Below this the DP tracker has too few frames to place a beat sequence.
constexpr size_t kMinOnsetsForBeats = 10;
constexpr float kSecondsPerMinute = 60.0f;
// Full-scale for signed 16-bit PCM, scaling float samples in [-1, 1].
constexpr float kInt16Max = 32767.0f;

}  // namespace

BeatResult BeatTracker::Analyze(const float* pcm, int num_frames,
                                int sample_rate) {
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

std::vector<float> BeatTracker::ComputeOnsetFunction(const float* pcm,
                                                     int num_frames) {
  const int num_stft_frames =
      std::max(0, (num_frames - kFftSize) / kHopSize) + 1;
  if (num_stft_frames < kMinStftFrames) {
    return {};
  }

  // Hann window
  std::vector<float> window(kFftSize);
  fft_hann(window.data(), kFftSize);

  // FFT work buffer: interleaved complex
  std::vector<float> fft_buf(2 * kFftSize);

  // Magnitude spectrum buffer (unique bins)
  const int num_bins = kFftSize / 2 + 1;
  std::vector<float> mag(num_bins);

  // Onset function (spectral flux)
  std::vector<float> onset(num_stft_frames);

  // Previous magnitude
  std::vector<float> prev_mag(num_bins, 0.0f);

  for (int f = 0; f < num_stft_frames; ++f) {
    const int offset = f * kHopSize;

    // Window the frame
    for (int i = 0; i < kFftSize; ++i) {
      const int idx = offset + i;
      if (idx < num_frames) {
        fft_buf[2 * i] = pcm[idx] * window[i];
      } else {
        fft_buf[2 * i] = 0.0f;
      }
      fft_buf[2 * i + 1] = 0.0f;
    }

    // Forward FFT
    fft(fft_buf.data(), kFftSize, false);

    // Magnitude spectrum
    for (int i = 0; i < num_bins; ++i) {
      const float re = fft_buf[2 * i];
      const float im = fft_buf[2 * i + 1];
      mag[i] = std::sqrt(re * re + im * im);
    }

    // Spectral flux: sum of positive differences
    float flux = 0.0f;
    for (int i = 0; i < num_bins; ++i) {
      const float diff = mag[i] - prev_mag[i];
      if (diff > 0.0f) {
        flux += diff;
      }
    }
    onset[f] = flux / static_cast<float>(num_bins);

    prev_mag = mag;
  }

  // Normalize to [0, 1]
  float max_val = 0.0f;
  for (const float v : onset) {
    if (v > max_val) max_val = v;
  }
  if (max_val > 0.0f) {
    for (float& v : onset) v /= max_val;
  }

  // Moving average smoothing (5-frame window)
  std::vector<float> smoothed(onset.size(), 0.0f);
  for (size_t f = 0; f < onset.size(); ++f) {
    float sum = 0.0f;
    int count = 0;
    for (int d = -2; d <= 2; ++d) {
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

float BeatTracker::EstimateTempo(const std::vector<float>& onset,
                                 float hop_time) {
  const size_t n = onset.size();
  if (n < kMinOnsetsForTempo) return 0.0f;

  const int min_lag =
      static_cast<int>(kSecondsPerMinute / (kMaxBpm * hop_time));
  const int max_lag =
      static_cast<int>(kSecondsPerMinute / (kMinBpm * hop_time)) + 1;

  if (min_lag >= max_lag || min_lag < 1) return 0.0f;

  // Autocorrelation of onset function
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

  // Find strongest local peak
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

  if (best_lag <= 0) return 0.0f;

  // Check for half-time: if a strong peak at half the lag, prefer it
  if (best_lag >= min_lag * 2 && best_lag / 2 >= min_lag) {
    if (acf[best_lag / 2] > 0.5f * max_acf) {
      best_lag /= 2;
    }
  }

  return kSecondsPerMinute / (static_cast<float>(best_lag) * hop_time);
}

std::vector<float> BeatTracker::TrackBeats(const std::vector<float>& onset,
                                           float hop_time, float bpm) {
  const size_t n = onset.size();
  if (n < kMinOnsetsForBeats || bpm <= 0.0f) return {};

  const float period_frames = kSecondsPerMinute / (bpm * hop_time);
  const int period = static_cast<int>(std::round(period_frames));
  if (period < 2) return {};

  // Mean onset for penalty scaling
  float sum_onset = 0.0f;
  for (const float v : onset) sum_onset += v;
  const float mean_onset = sum_onset / n;
  const float penalty =
      kTransitionPenalty * (mean_onset > 0.0f ? mean_onset : 0.01f);

  std::vector<float> score(n, 0.0f);
  std::vector<int> backlink(n, -1);

  // DP forward pass
  for (size_t i = 0; i < n; ++i) {
    const int search_start = std::max(0, static_cast<int>(i) - 2 * period);
    const int search_end = std::max(0, static_cast<int>(i) - period / 2);

    float best_score = 0.0f;
    int best_prev = -1;

    for (int j = search_start; j < search_end && j < static_cast<int>(i); ++j) {
      const float gap = static_cast<float>(i - j);
      const float deviation = (gap - period_frames) / period_frames;
      const float candidate = score[j] - penalty * deviation * deviation;
      if (candidate > best_score) {
        best_score = candidate;
        best_prev = j;
      }
    }

    score[i] = onset[i] + best_score;
    backlink[i] = best_prev;
  }

  // Find last beat in the final period window
  int last_beat = static_cast<int>(n) - 1;
  float max_score = 0.0f;
  const size_t search_start = n > static_cast<size_t>(period) ? n - period : 0;
  for (size_t i = search_start; i < n; ++i) {
    if (score[i] > max_score) {
      max_score = score[i];
      last_beat = static_cast<int>(i);
    }
  }

  // Backtrack
  float beats_buf[2048];
  int beat_count = 0;
  int b = last_beat;
  while (b >= 0 && beat_count < 2048) {
    beats_buf[beat_count++] = static_cast<float>(b) * hop_time;
    b = backlink[b];
  }

  if (beat_count < 3) return {};

  std::vector<float> beats(beat_count);
  for (int i = 0; i < beat_count; ++i) {
    beats[i] = beats_buf[beat_count - 1 - i];
  }

  return beats;
}

WaveformPeaks BeatTracker::ComputeWaveformPeaks(const float* pcm,
                                                int num_frames, int channels,
                                                int target_chunks) {
  WaveformPeaks result;
  if (num_frames <= 0 || channels <= 0 || target_chunks <= 0) {
    return result;
  }

  const int chunk_size = std::max(1, num_frames / target_chunks);
  const int actual_chunks = num_frames / chunk_size;

  result.data.resize(static_cast<size_t>(actual_chunks) * channels * 2);
  result.channels = channels;
  result.chunk_count = actual_chunks;
  result.total_frames = num_frames;

  for (int c = 0; c < actual_chunks; ++c) {
    const int start = c * chunk_size * channels;
    const int end =
        std::min(start + chunk_size * channels, num_frames * channels);

    for (int ch = 0; ch < channels; ++ch) {
      float min_val = 1.0f, max_val = -1.0f;
      for (int s = start + ch; s < end; s += channels) {
        if (pcm[s] < min_val) min_val = pcm[s];
        if (pcm[s] > max_val) max_val = pcm[s];
      }
      const int idx = (c * channels + ch) * 2;
      result.data[idx] = static_cast<int16_t>(min_val * kInt16Max);
      result.data[idx + 1] = static_cast<int16_t>(max_val * kInt16Max);
    }
  }

  return result;
}

}  // namespace kitbag
