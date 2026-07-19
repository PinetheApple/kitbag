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
  lock_state_ = LockState::kNone;
  lock_counter_ = 0;
  lock_cents_sum_ = 0.0;
  re_lock_note_ = -1;
  re_lock_frames_ = 0;
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

  if (lock_state_ != LockState::kLocked && re_lock_frames_ > 0) {
    --re_lock_frames_;
  }
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

void PitchAnalyzer::EnterRiding() {
  lock_state_ = LockState::kRiding;
  lock_counter_ = 1;
  re_lock_note_ = locked_note_;
  re_lock_frames_ = kReLockSamples;
  last_locked_reading_ = reading_;
}

PitchAnalyzer::LockOutcome PitchAnalyzer::AdvanceFromNone(
    int32_t raw_note,
    double raw_cents,
    LockUpdate* update
) {
  if (raw_note < 0) {
    return LockOutcome::kSilence;
  }
  // A note reappearing inside the re-lock window skips re-acquisition.
  if (raw_note == re_lock_note_ && re_lock_frames_ > 0) {
    lock_state_ = LockState::kLocked;
    lock_counter_ = 0;
    re_lock_note_ = -1;
    re_lock_frames_ = 0;
    *update = {raw_note, raw_cents};
    return LockOutcome::kPublish;
  }
  lock_state_ = LockState::kLocking;
  locked_note_ = raw_note;
  lock_counter_ = 1;
  lock_cents_sum_ = raw_cents;
  return LockOutcome::kSilence;
}

PitchAnalyzer::LockOutcome PitchAnalyzer::AdvanceFromLocking(
    int32_t raw_note,
    double raw_cents,
    LockUpdate* update
) {
  if (raw_note != locked_note_ || std::fabs(raw_cents) > kLockCentsThreshold) {
    lock_state_ = LockState::kNone;
    lock_counter_ = 0;
    lock_cents_sum_ = 0.0;
    return LockOutcome::kSilence;
  }
  ++lock_counter_;
  lock_cents_sum_ += raw_cents;
  if (lock_counter_ < kLockAcquireSamples) {
    return LockOutcome::kSilence;
  }
  lock_state_ = LockState::kLocked;
  lock_counter_ = 0;
  // Publish the mean over the acquisition window, not just the last frame.
  *update = {
      locked_note_,
      lock_cents_sum_ / static_cast<double>(kLockAcquireSamples)
  };
  lock_cents_sum_ = 0.0;
  return LockOutcome::kPublish;
}

PitchAnalyzer::LockOutcome PitchAnalyzer::AdvanceFromLocked(
    int32_t raw_note,
    double raw_cents,
    LockUpdate* update
) {
  if (raw_note == locked_note_) {
    lock_counter_ = 0;
    re_lock_note_ = -1;
    re_lock_frames_ = 0;
    *update = {locked_note_, raw_cents};
    return LockOutcome::kPublish;
  }
  if (raw_note < 0) {
    EnterRiding();
    return LockOutcome::kSilence;
  }
  ++lock_counter_;
  re_lock_note_ = locked_note_;
  re_lock_frames_ = kReLockSamples;
  if (lock_counter_ >= kReLockSamples) {
    lock_state_ = LockState::kNone;
    lock_counter_ = 0;
  }
  return LockOutcome::kSilence;
}

PitchAnalyzer::LockOutcome PitchAnalyzer::AdvanceFromRiding(
    int32_t raw_note,
    double raw_cents,
    LockUpdate* update
) {
  if (raw_note == locked_note_) {
    lock_state_ = LockState::kLocked;
    lock_counter_ = 0;
    *update = {locked_note_, raw_cents};
    return LockOutcome::kPublish;
  }
  ++lock_counter_;
  if (lock_counter_ >= kRideMaxSamples) {
    lock_state_ = LockState::kNone;
    lock_counter_ = 0;
    return LockOutcome::kSilence;
  }
  return LockOutcome::kHold;
}

PitchAnalyzer::LockOutcome PitchAnalyzer::AdvanceLock(
    int32_t raw_note,
    double raw_cents,
    LockUpdate* update
) {
  switch (lock_state_) {
    case LockState::kNone:
      return AdvanceFromNone(raw_note, raw_cents, update);
    case LockState::kLocking:
      return AdvanceFromLocking(raw_note, raw_cents, update);
    case LockState::kLocked:
      return AdvanceFromLocked(raw_note, raw_cents, update);
    case LockState::kRiding:
      return AdvanceFromRiding(raw_note, raw_cents, update);
  }
  return LockOutcome::kSilence;
}

void PitchAnalyzer::PublishReading(const LockUpdate& update) {
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

void PitchAnalyzer::PublishFrequency(double frequency_hz) {
  const double median_hz = MedianHz(frequency_hz);
  const int32_t raw_note = NoteIndexForFrequency(median_hz, a4_hz_);
  const double raw_cents = CentsOffsetForFrequency(median_hz, a4_hz_);

  LockUpdate update;
  switch (AdvanceLock(raw_note, raw_cents, &update)) {
    case LockOutcome::kPublish:
      PublishReading(update);
      return;
    case LockOutcome::kHold:
      // Freeze on a transient miss rather than blanking the display.
      reading_ = last_locked_reading_;
      return;
    case LockOutcome::kSilence:
      PublishSilence();
      return;
  }
}

void PitchAnalyzer::HandleNoSignal() {
  switch (lock_state_) {
    case LockState::kNone:
    case LockState::kLocking:
      lock_state_ = LockState::kNone;
      lock_counter_ = 0;
      lock_cents_sum_ = 0.0;
      break;

    case LockState::kLocked:
      EnterRiding();
      break;

    case LockState::kRiding:
      ++lock_counter_;
      if (lock_counter_ >= kRideMaxSamples) {
        lock_state_ = LockState::kNone;
        lock_counter_ = 0;
      }
      break;
  }

  if (lock_state_ == LockState::kRiding) {
    reading_ = last_locked_reading_;
  } else {
    PublishSilence();
  }
}

void PitchAnalyzer::PublishSilence() {
  reading_ = Reading{};
  median_filled_ = 0;
  ema_seeded_ = false;
  detector_->reset();
}

}  // namespace kitbag
