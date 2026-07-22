#ifndef KITBAG_TUNER_NOTE_LOCK_H
#define KITBAG_TUNER_NOTE_LOCK_H

// The tuner's note-lock state machine, split from PitchAnalyzer so it can be
// tested without a working detector (SPEC.md §10.1). Pure scalar state.
#include <cmath>
#include <cstdint>

namespace kitbag {

class NoteLock {
 public:
  // Sample counts are at the analyzer's 60 Hz update rate.
  static constexpr int kLockAcquireSamples = 20;
  static constexpr double kLockCentsThreshold = 18.0;
  static constexpr int kRideMaxSamples = 22;
  static constexpr int kReLockSamples = 90;

  enum class State { kNone, kLocking, kLocked, kRiding };
  // kHold freezes the last locked reading; kSilence blanks it.
  enum class Outcome { kPublish, kSilence, kHold };

  struct Update {
    int32_t note = -1;
    double cents = 0.0;
  };

  State state() const {
    return state_;
  }
  int32_t locked_note() const {
    return locked_note_;
  }

  Outcome Advance(int32_t raw_note, double raw_cents, Update* update);
  // Returns kHold while riding out a dropout, kSilence once the ride expires.
  Outcome HandleNoSignal();
  // Ages the re-lock window by one update; only an unlocked machine is riding
  // out a window, so a held lock does not consume it.
  void TickReLockWindow() {
    if (state_ != State::kLocked && re_lock_frames_ > 0) --re_lock_frames_;
  }
  void Reset();

 private:
  Outcome AdvanceFromNone(int32_t raw_note, double raw_cents, Update* update);
  Outcome
  AdvanceFromLocking(int32_t raw_note, double raw_cents, Update* update);
  Outcome AdvanceFromLocked(int32_t raw_note, double raw_cents, Update* update);
  Outcome AdvanceFromRiding(int32_t raw_note, double raw_cents, Update* update);
  void EnterRiding();
  void EnterNone();

  State state_ = State::kNone;
  int32_t locked_note_ = -1;
  int counter_ = 0;
  double cents_sum_ = 0.0;
  int32_t re_lock_note_ = -1;
  int re_lock_frames_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_NOTE_LOCK_H
