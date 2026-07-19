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
  return static_cast<int32_t>(
      std::lround(MidiForFrequency(frequency_hz, a4_hz))
  );
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
      samples_per_update_(static_cast<int>(sample_rate / kUpdatesPerSecond)) {
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
  detector_.emplace(
      cycfi::q::frequency(band_low_hz_),
      cycfi::q::frequency(band_high_hz_),
      static_cast<float>(sample_rate_),
      cycfi::q::dB(kDetectorHysteresisDb)
  );
  samples_until_update_ = samples_per_update_;
  median_filled_ = 0;
  ema_seeded_ = false;
  lock_.Reset();
  previous_lock_state_ = NoteLock::State::kNone;
  gate_open_ = false;
  rms_envelope_ = 0.0;
  noise_floor_ = 0.0;
  PublishSilence();
}

void PitchAnalyzer::UpdateNoiseGate(double sample_sq) {
  rms_envelope_ += (sample_sq > rms_envelope_ ? kRmsAttack : kRmsRelease) *
                   (sample_sq - rms_envelope_);
  // Slow attack tracks the ambient floor; fast release follows a real drop.
  noise_floor_ +=
      (sample_sq > noise_floor_ ? kNoiseFloorAttack : kNoiseFloorRelease) *
      (sample_sq - noise_floor_);

  // Relative to the tracked floor, so a noisy room raises the bar with it.
  const double noise_rms = std::sqrt(noise_floor_);
  const double gate_threshold =
      std::max(kHardFloor, noise_rms * std::pow(10.0, kGateThresholdDb / 20.0));
  gate_open_ = std::sqrt(rms_envelope_) > gate_threshold;
}

bool PitchAnalyzer::Process(float sample) {
  const double value = static_cast<double>(sample);
  UpdateNoiseGate(value * value);

  (*detector_)(sample);

  if (--samples_until_update_ > 0) {
    return false;
  }
  samples_until_update_ = samples_per_update_;

  const double frequency = detector_->get_frequency();
  if (gate_open_ && frequency > 0.0) {
    PublishFrequency(frequency);
  } else {
    HandleNoSignal();
  }

  lock_.TickReLockWindow();
  return true;
}

double PitchAnalyzer::MedianHz(double frequency_hz) {
  if (median_filled_ < kMedianLength) {
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

void PitchAnalyzer::PublishReading(const NoteLock::Update& update) {
  // Reseed rather than smooth across a note change: an EMA spanning two notes
  // would sweep the needle through the interval between them.
  if (!ema_seeded_ || update.note != reading_.note_index) {
    ema_cents_ = update.cents;
    ema_seeded_ = true;
  } else {
    ema_cents_ += kCentsEmaAlpha * (update.cents - ema_cents_);
  }

  reading_.note_index = update.note;
  reading_.cents = ema_cents_;
  reading_.pitch_hz =
      a4_hz_ * std::exp2(
                   (update.note - kMidiA4 + ema_cents_ / kCentsPerSemitone) /
                   kSemitonesPerOctave
               );
  reading_.confidence = detector_->periodicity();
}

void PitchAnalyzer::ApplyOutcome(
    NoteLock::Outcome outcome,
    const NoteLock::Update& update
) {
  const bool entered_riding = lock_.state() == NoteLock::State::kRiding &&
                              previous_lock_state_ != NoteLock::State::kRiding;
  if (entered_riding) last_locked_reading_ = reading_;
  previous_lock_state_ = lock_.state();

  switch (outcome) {
    case NoteLock::Outcome::kPublish:
      PublishReading(update);
      return;
    case NoteLock::Outcome::kHold:
      // Freeze on a transient miss rather than blanking the display.
      reading_ = last_locked_reading_;
      return;
    case NoteLock::Outcome::kSilence:
      PublishSilence();
      return;
  }
}

void PitchAnalyzer::PublishFrequency(double frequency_hz) {
  const double median_hz = MedianHz(frequency_hz);
  const int32_t raw_note = NoteIndexForFrequency(median_hz, a4_hz_);
  const double raw_cents = CentsOffsetForFrequency(median_hz, a4_hz_);

  NoteLock::Update update;
  ApplyOutcome(lock_.Advance(raw_note, raw_cents, &update), update);
}

void PitchAnalyzer::HandleNoSignal() {
  ApplyOutcome(lock_.HandleNoSignal(), NoteLock::Update{});
}

void PitchAnalyzer::PublishSilence() {
  reading_ = Reading{};
  median_filled_ = 0;
  ema_seeded_ = false;
  detector_->reset();
}

}  // namespace kitbag
