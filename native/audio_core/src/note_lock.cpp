// The four lock transitions. Behaviour is unchanged from the version that lived
// inside PitchAnalyzer; only the state it owns moved.
#include "note_lock.h"

namespace kitbag {

void NoteLock::EnterNone() {
  state_ = State::kNone;
  counter_ = 0;
  cents_sum_ = 0.0;
}

void NoteLock::EnterRiding() {
  state_ = State::kRiding;
  counter_ = 1;
  re_lock_note_ = locked_note_;
  re_lock_frames_ = kReLockSamples;
}

void NoteLock::Reset() {
  EnterNone();
  locked_note_ = -1;
  re_lock_note_ = -1;
  re_lock_frames_ = 0;
}

NoteLock::Outcome
NoteLock::AdvanceFromNone(int32_t raw_note, double raw_cents, Update* update) {
  if (raw_note < 0) return Outcome::kSilence;
  // A note reappearing inside the re-lock window skips re-acquisition.
  if (raw_note == re_lock_note_ && re_lock_frames_ > 0) {
    state_ = State::kLocked;
    counter_ = 0;
    re_lock_note_ = -1;
    re_lock_frames_ = 0;
    *update = {raw_note, raw_cents};
    return Outcome::kPublish;
  }
  state_ = State::kLocking;
  locked_note_ = raw_note;
  counter_ = 1;
  cents_sum_ = raw_cents;
  return Outcome::kSilence;
}

NoteLock::Outcome NoteLock::AdvanceFromLocking(
    int32_t raw_note,
    double raw_cents,
    Update* update
) {
  if (raw_note != locked_note_ || std::fabs(raw_cents) > kLockCentsThreshold) {
    EnterNone();
    return Outcome::kSilence;
  }
  ++counter_;
  cents_sum_ += raw_cents;
  if (counter_ < kLockAcquireSamples) return Outcome::kSilence;
  state_ = State::kLocked;
  counter_ = 0;
  // Publish the mean over the acquisition window, not just the last frame.
  *update = {
      locked_note_,
      cents_sum_ / static_cast<double>(kLockAcquireSamples)
  };
  cents_sum_ = 0.0;
  return Outcome::kPublish;
}

NoteLock::Outcome NoteLock::AdvanceFromLocked(
    int32_t raw_note,
    double raw_cents,
    Update* update
) {
  if (raw_note == locked_note_) {
    counter_ = 0;
    re_lock_note_ = -1;
    re_lock_frames_ = 0;
    *update = {locked_note_, raw_cents};
    return Outcome::kPublish;
  }
  if (raw_note < 0) {
    EnterRiding();
    return Outcome::kSilence;
  }
  ++counter_;
  re_lock_note_ = locked_note_;
  re_lock_frames_ = kReLockSamples;
  if (counter_ >= kReLockSamples) EnterNone();
  return Outcome::kSilence;
}

NoteLock::Outcome NoteLock::AdvanceFromRiding(
    int32_t raw_note,
    double raw_cents,
    Update* update
) {
  if (raw_note == locked_note_) {
    state_ = State::kLocked;
    counter_ = 0;
    *update = {locked_note_, raw_cents};
    return Outcome::kPublish;
  }
  ++counter_;
  if (counter_ >= kRideMaxSamples) {
    EnterNone();
    return Outcome::kSilence;
  }
  return Outcome::kHold;
}

NoteLock::Outcome
NoteLock::Advance(int32_t raw_note, double raw_cents, Update* update) {
  switch (state_) {
    case State::kNone:
      return AdvanceFromNone(raw_note, raw_cents, update);
    case State::kLocking:
      return AdvanceFromLocking(raw_note, raw_cents, update);
    case State::kLocked:
      return AdvanceFromLocked(raw_note, raw_cents, update);
    case State::kRiding:
      return AdvanceFromRiding(raw_note, raw_cents, update);
  }
  return Outcome::kSilence;
}

NoteLock::Outcome NoteLock::HandleNoSignal() {
  switch (state_) {
    case State::kNone:
    case State::kLocking:
      EnterNone();
      break;
    case State::kLocked:
      EnterRiding();
      break;
    case State::kRiding:
      ++counter_;
      if (counter_ >= kRideMaxSamples) {
        state_ = State::kNone;
        counter_ = 0;
      }
      break;
  }
  return state_ == State::kRiding ? Outcome::kHold : Outcome::kSilence;
}

}  // namespace kitbag
