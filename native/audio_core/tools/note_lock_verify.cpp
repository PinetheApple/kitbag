// Pins the tuner's note-lock transitions. This runs without the detector, which
// reports 0.000 Hz for every tone (SPEC.md §10.1) and so exercises none of it.
#include <cstdio>

#include "note_lock.h"

namespace {

int g_failures = 0;
// Counted so a deleted TestX() call cannot pass silently: the total is a
// tripwire on the suite's own shape, not a derived expectation.
int g_checks = 0;

void Check(bool condition, const char* message) {
  ++g_checks;
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

using kitbag::NoteLock;

// Feeds `note` for `count` updates, returning the last outcome seen.
NoteLock::Outcome Feed(NoteLock* lock, int32_t note, double cents, int count) {
  NoteLock::Outcome outcome = NoteLock::Outcome::kSilence;
  for (int i = 0; i < count; ++i) {
    NoteLock::Update update;
    outcome = lock->Advance(note, cents, &update);
  }
  return outcome;
}

// kNone -> kLocking -> kLocked takes exactly kLockAcquireSamples updates, and
// the published cents are the window mean, not the last frame.
void TestAcquireRequiresFullWindow() {
  NoteLock lock;
  NoteLock::Update update;
  Check(
      lock.Advance(69, 0.0, &update) == NoteLock::Outcome::kSilence,
      "acquire: the first sighting does not publish"
  );
  Check(lock.state() == NoteLock::State::kLocking, "acquire: enters kLocking");

  // One short of the window: still silent.
  Feed(&lock, 69, 0.0, NoteLock::kLockAcquireSamples - 2);
  Check(
      lock.state() == NoteLock::State::kLocking,
      "acquire: still locking one update short of the window"
  );

  // Final update carries a different offset, in range but far from the rest, so
  // the mean (0.85) and the last frame (17.0) cannot be confused.
  const NoteLock::Outcome outcome = lock.Advance(69, 17.0, &update);
  Check(outcome == NoteLock::Outcome::kPublish, "acquire: publishes on lock");
  Check(lock.state() == NoteLock::State::kLocked, "acquire: enters kLocked");
  Check(update.note == 69, "acquire: publishes the acquired note");
  Check(
      update.cents > 0.8 && update.cents < 0.9,
      "acquire: publishes the window mean, not the last frame"
  );
}

// A wildly out-of-tune reading aborts acquisition rather than locking onto it.
void TestAcquireAbortsBeyondCentsThreshold() {
  NoteLock lock;
  NoteLock::Update update;
  lock.Advance(69, 0.0, &update);
  const double off = NoteLock::kLockCentsThreshold + 1.0;
  Check(
      lock.Advance(69, off, &update) == NoteLock::Outcome::kSilence,
      "acquire: an off-threshold reading does not publish"
  );
  Check(
      lock.state() == NoteLock::State::kNone,
      "acquire: an off-threshold reading drops back to kNone"
  );
}

// kLocked -> kRiding on signal loss: the ride holds for kRideMaxSamples, then
// gives up. Holding is what stops the needle blanking between bow strokes.
void TestLockedRidesOutADropoutThenGivesUp() {
  NoteLock lock;
  NoteLock::Update update;
  Feed(&lock, 69, 0.0, NoteLock::kLockAcquireSamples);
  Check(lock.state() == NoteLock::State::kLocked, "ride: locked first");

  Check(
      lock.HandleNoSignal() == NoteLock::Outcome::kHold,
      "ride: signal loss holds rather than blanking"
  );
  Check(lock.state() == NoteLock::State::kRiding, "ride: enters kRiding");

  // Already one update into the ride, so this lands exactly on the limit.
  NoteLock::Outcome outcome = NoteLock::Outcome::kHold;
  for (int i = 1; i < NoteLock::kRideMaxSamples; ++i) {
    outcome = lock.HandleNoSignal();
  }
  Check(
      outcome == NoteLock::Outcome::kSilence,
      "ride: blanks once kRideMaxSamples is reached"
  );
  Check(
      lock.state() == NoteLock::State::kNone,
      "ride: expiring drops back to kNone"
  );
}

// A negative note is signal loss arriving through Advance rather than
// HandleNoSignal, and must ride the lock out rather than tear it down.
void TestLockedRidesOnANegativeNote() {
  NoteLock lock;
  NoteLock::Update update;
  Feed(&lock, 69, 0.0, NoteLock::kLockAcquireSamples);
  lock.Advance(-1, 0.0, &update);
  Check(
      lock.state() == NoteLock::State::kRiding,
      "locked: a negative note rides rather than dropping the lock"
  );
  Check(
      lock.locked_note() == 69,
      "locked: riding on a negative note keeps the locked note"
  );
}

// kRiding -> kLocked the moment the original note returns.
void TestRidingRelocksOnTheSameNote() {
  NoteLock lock;
  NoteLock::Update update;
  Feed(&lock, 69, 0.0, NoteLock::kLockAcquireSamples);
  lock.HandleNoSignal();
  Check(lock.state() == NoteLock::State::kRiding, "riding: riding first");

  Check(
      lock.Advance(69, 3.0, &update) == NoteLock::Outcome::kPublish,
      "riding: the original note returning publishes immediately"
  );
  Check(lock.state() == NoteLock::State::kLocked, "riding: back to kLocked");
  Check(
      update.cents > 2.9 && update.cents < 3.1,
      "riding: republishes the live cents, not the acquisition mean"
  );
}

// After the lock is dropped, the same note re-locks instantly while the
// re-lock window survives — and re-acquires the long way once it has expired.
void TestReLockWindowSkipsReacquisition() {
  NoteLock lock;
  NoteLock::Update update;
  Feed(&lock, 69, 0.0, NoteLock::kLockAcquireSamples);
  // A different note held long enough tears the lock down and opens the window.
  Feed(&lock, 71, 0.0, NoteLock::kReLockSamples);
  Check(lock.state() == NoteLock::State::kNone, "relock: the lock was dropped");

  Check(
      lock.Advance(69, 2.0, &update) == NoteLock::Outcome::kPublish,
      "relock: the previous note re-locks without re-acquiring"
  );
  Check(
      lock.state() == NoteLock::State::kLocked,
      "relock: straight to kLocked"
  );

  // Now let the window age out and confirm the shortcut is gone.
  NoteLock expired;
  Feed(&expired, 69, 0.0, NoteLock::kLockAcquireSamples);
  Feed(&expired, 71, 0.0, NoteLock::kReLockSamples);
  for (int i = 0; i < NoteLock::kReLockSamples; ++i) expired.TickReLockWindow();
  Check(
      expired.Advance(69, 2.0, &update) == NoteLock::Outcome::kSilence,
      "relock: an expired window forces full re-acquisition"
  );
  Check(
      expired.state() == NoteLock::State::kLocking,
      "relock: an expired window re-enters kLocking"
  );
}

}  // namespace

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 25;

int main() {
  TestAcquireRequiresFullWindow();
  TestAcquireAbortsBeyondCentsThreshold();
  TestLockedRidesOutADropoutThenGivesUp();
  TestLockedRidesOnANegativeNote();
  TestRidingRelocksOnTheSameNote();
  TestReLockWindowSkipsReacquisition();

  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "note_lock_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures == 0) {
    std::printf("note_lock_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "note_lock_verify: %d failure(s)\n", g_failures);
  return 1;
}
