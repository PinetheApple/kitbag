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

bool PitchAnalyzer::Process(float sample) {
  const double sample_sq =
      static_cast<double>(sample) * static_cast<double>(sample);
  if (sample_sq > rms_envelope_) {
    rms_envelope_ += kRmsAttack * (sample_sq - rms_envelope_);
  } else {
    rms_envelope_ += kRmsRelease * (sample_sq - rms_envelope_);
  }

  // Noise floor tracker: slow attack (ambient tracking), fast release
  if (sample_sq > noise_floor_) {
    noise_floor_ += kNoiseFloorAttack * (sample_sq - noise_floor_);
  } else {
    noise_floor_ += kNoiseFloorRelease * (sample_sq - noise_floor_);
  }

  // Relative to the tracked floor, so a noisy room raises the bar with it.
  const double rms = std::sqrt(rms_envelope_);
  const double noise_rms = std::sqrt(noise_floor_);
  const double gate_threshold =
      std::max(kHardFloor, noise_rms * std::pow(10.0, kGateThresholdDb / 20.0));
  gate_open_ = rms > gate_threshold;

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

void PitchAnalyzer::PublishFrequency(double frequency_hz) {
  const double median_hz = MedianHz(frequency_hz);
  const int32_t raw_note = NoteIndexForFrequency(median_hz, a4_hz_);
  const double raw_cents = CentsOffsetForFrequency(median_hz, a4_hz_);

  bool should_publish = false;
  int32_t publish_note = -1;
  double publish_cents = 0.0;

  switch (lock_state_) {
    case LockState::kNone:
      if (raw_note >= 0) {
        if (raw_note == re_lock_note_ && re_lock_frames_ > 0) {
          lock_state_ = LockState::kLocked;
          lock_counter_ = 0;
          should_publish = true;
          publish_note = raw_note;
          publish_cents = raw_cents;
          re_lock_note_ = -1;
          re_lock_frames_ = 0;
        } else {
          lock_state_ = LockState::kLocking;
          locked_note_ = raw_note;
          lock_counter_ = 1;
          lock_cents_sum_ = raw_cents;
        }
      }
      break;

    case LockState::kLocking:
      if (raw_note == locked_note_ &&
          std::fabs(raw_cents) <= kLockCentsThreshold) {
        ++lock_counter_;
        lock_cents_sum_ += raw_cents;
        if (lock_counter_ >= kLockAcquireSamples) {
          lock_state_ = LockState::kLocked;
          lock_counter_ = 0;
          should_publish = true;
          publish_note = locked_note_;
          publish_cents =
              lock_cents_sum_ / static_cast<double>(kLockAcquireSamples);
          lock_cents_sum_ = 0.0;
        }
      } else {
        lock_state_ = LockState::kNone;
        lock_counter_ = 0;
        lock_cents_sum_ = 0.0;
      }
      break;

    case LockState::kLocked:
      if (raw_note == locked_note_) {
        lock_counter_ = 0;
        should_publish = true;
        publish_note = locked_note_;
        publish_cents = raw_cents;
        re_lock_note_ = -1;
        re_lock_frames_ = 0;
      } else if (raw_note < 0) {
        lock_state_ = LockState::kRiding;
        lock_counter_ = 1;
        re_lock_note_ = locked_note_;
        re_lock_frames_ = kReLockSamples;
        last_locked_reading_ = reading_;
      } else {
        ++lock_counter_;
        re_lock_note_ = locked_note_;
        re_lock_frames_ = kReLockSamples;
        if (lock_counter_ >= kReLockSamples) {
          lock_state_ = LockState::kNone;
          lock_counter_ = 0;
        }
      }
      break;

    case LockState::kRiding:
      if (raw_note == locked_note_) {
        lock_state_ = LockState::kLocked;
        lock_counter_ = 0;
        should_publish = true;
        publish_note = locked_note_;
        publish_cents = raw_cents;
      } else {
        ++lock_counter_;
        if (lock_counter_ >= kRideMaxSamples) {
          lock_state_ = LockState::kNone;
          lock_counter_ = 0;
        } else {
          reading_ = last_locked_reading_;
          return;
        }
      }
      break;
  }

  if (!should_publish) {
    PublishSilence();
    return;
  }

  if (!ema_seeded_ || publish_note != reading_.note_index) {
    ema_cents_ = publish_cents;
    ema_seeded_ = true;
  } else {
    ema_cents_ += kCentsEmaAlpha * (publish_cents - ema_cents_);
  }

  reading_.note_index = publish_note;
  reading_.cents = ema_cents_;
  reading_.pitch_hz =
      a4_hz_ * std::exp2(
                   (publish_note - kMidiA4 + ema_cents_ / kCentsPerSemitone) /
                   kSemitonesPerOctave
               );
  reading_.confidence = detector_->periodicity();
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
      lock_state_ = LockState::kRiding;
      lock_counter_ = 1;
      re_lock_note_ = locked_note_;
      re_lock_frames_ = kReLockSamples;
      last_locked_reading_ = reading_;
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
