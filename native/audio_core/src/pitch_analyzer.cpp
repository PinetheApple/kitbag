#include "pitch_analyzer.h"

#include <algorithm>
#include <cmath>

namespace kitbag {

namespace {

constexpr double kSemitonesPerOctave = 12.0;
constexpr double kCentsPerSemitone = 100.0;
constexpr int32_t kMidiA4 = 69;

double MidiForFrequency(double frequency_hz, double a4_hz) {
  return kMidiA4 + kSemitonesPerOctave * std::log2(frequency_hz / a4_hz);
}

}  // namespace

int32_t NoteIndexForFrequency(double frequency_hz, double a4_hz) {
  if (frequency_hz <= 0.0) {
    return -1;
  }
  return static_cast<int32_t>(std::lround(MidiForFrequency(frequency_hz, a4_hz)));
}

double CentsOffsetForFrequency(double frequency_hz, double a4_hz) {
  if (frequency_hz <= 0.0) {
    return 0.0;
  }
  const double midi = MidiForFrequency(frequency_hz, a4_hz);
  return (midi - std::lround(midi)) * kCentsPerSemitone;
}

PitchAnalyzer::PitchAnalyzer(double sample_rate, double low_hz, double high_hz)
    : sample_rate_(sample_rate),
      band_low_hz_(low_hz),
      band_high_hz_(high_hz),
      samples_per_update_(static_cast<int>(sample_rate / kUpdatesPerSecond)),
      envelope_decay_(std::exp(-kGateReleasePerSecond / sample_rate)) {
  RebuildDetector();
}

void PitchAnalyzer::SetA4(double a4_hz) {
  a4_hz_ = std::clamp(a4_hz, kMinA4Hz, kMaxA4Hz);
}

void PitchAnalyzer::SetBand(double low_hz, double high_hz) {
  if (low_hz <= 0.0 || high_hz <= low_hz) {
    return;
  }
  band_low_hz_ = low_hz;
  band_high_hz_ = high_hz;
  RebuildDetector();
}

void PitchAnalyzer::RebuildDetector() {
  detector_.emplace(cycfi::q::frequency(band_low_hz_),
                    cycfi::q::frequency(band_high_hz_),
                    static_cast<float>(sample_rate_),
                    cycfi::q::dB(kDetectorHysteresisDb));
  samples_until_update_ = samples_per_update_;
  median_filled_ = 0;
  ema_seeded_ = false;
  PublishSilence();
}

bool PitchAnalyzer::Process(float sample) {
  const double magnitude = std::fabs(static_cast<double>(sample));
  envelope_ = std::max(magnitude, envelope_ * envelope_decay_);

  (*detector_)(sample);

  if (--samples_until_update_ > 0) {
    return false;
  }
  samples_until_update_ = samples_per_update_;

  const double frequency = detector_->get_frequency();
  if (envelope_ < kGateLevel || frequency <= 0.0) {
    PublishSilence();
  } else {
    PublishFrequency(frequency);
  }
  return true;
}

double PitchAnalyzer::MedianHz(double frequency_hz) {
  if (median_filled_ < kMedianLength) {
    // Warm-up: fill the whole window so early readings aren't biased to 0.
    std::fill(median_window_, median_window_ + kMedianLength, frequency_hz);
    median_filled_ = kMedianLength;
    return frequency_hz;
  }
  for (int i = 0; i < kMedianLength - 1; ++i) {
    median_window_[i] = median_window_[i + 1];
  }
  median_window_[kMedianLength - 1] = frequency_hz;

  double sorted[kMedianLength];
  std::copy(median_window_, median_window_ + kMedianLength, sorted);
  std::sort(sorted, sorted + kMedianLength);
  return sorted[kMedianLength / 2];
}

void PitchAnalyzer::PublishFrequency(double frequency_hz) {
  const double median_hz = MedianHz(frequency_hz);
  const int32_t note = NoteIndexForFrequency(median_hz, a4_hz_);
  const double cents = CentsOffsetForFrequency(median_hz, a4_hz_);

  // EMA smooths within a note; a note change re-seeds so the needle jumps
  // to the new string instead of gliding through no-man's-land.
  if (!ema_seeded_ || note != reading_.note_index) {
    ema_cents_ = cents;
    ema_seeded_ = true;
  } else {
    ema_cents_ += kCentsEmaAlpha * (cents - ema_cents_);
  }

  reading_.note_index = note;
  reading_.cents = ema_cents_;
  reading_.pitch_hz =
      a4_hz_ * std::exp2((note - kMidiA4 + ema_cents_ / kCentsPerSemitone) /
                         kSemitonesPerOctave);
  reading_.confidence = detector_->periodicity();
}

void PitchAnalyzer::PublishSilence() {
  reading_ = Reading{};
  median_filled_ = 0;
  ema_seeded_ = false;
  detector_->reset();
}

}  // namespace kitbag
