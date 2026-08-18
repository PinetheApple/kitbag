// Time-signature denominators (SPEC.md §17 D1): the beat interval is a function
// of both halves, an invalid denominator is ignored, and a change mid-run moves
// only future clicks.
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr double kBpm = 90.0;
constexpr double kSwitchBpm = 120.0;
constexpr int kNumerator = 7;
constexpr double kFixtureTolerance = 1e-3;

double BeatFrames(double bpm, int denominator) {
  return 60.0 / bpm * (4.0 / denominator) * kSampleRate;
}

void CheckNear(double actual, double expected, const char* label) {
  Check(std::fabs(actual - expected) < kFixtureTolerance, label);
}

// Pins the fixture rather than trusting BeatFrames: at 90 BPM the four
// denominators are 64000/32000/16000/8000 frames apart — all distinct, all
// clear of the onset detector's 6000-frame hold window.
void TestFixtureIntervalsDiscriminate() {
  CheckNear(BeatFrames(kBpm, 2), 64000.0, "fixture: half-note beat = 64000");
  CheckNear(BeatFrames(kBpm, 4), 32000.0, "fixture: quarter beat = 32000");
  CheckNear(BeatFrames(kBpm, 8), 16000.0, "fixture: eighth beat = 16000");
  CheckNear(BeatFrames(kBpm, 16), 8000.0, "fixture: sixteenth beat = 8000");
}

// Renders eight beats of an already-started metronome and pins both the count
// and the spacing against `denominator`'s beat unit.
void ExpectEightBeatsAt(
    kitbag::Metronome& metronome,
    int denominator,
    const char* label
) {
  constexpr int kBeats = 8;
  const double interval = BeatFrames(kBpm, denominator);
  const auto onsets =
      RenderAndDetectOnsets(metronome, static_cast<int64_t>(interval) * kBeats);
  Check(onsets.size() == kBeats, label);
  ExpectSpacing(onsets, 0, onsets.size(), interval, label);
}

void ExpectDenominatorSpacing(int denominator, const char* label) {
  kitbag::Metronome metronome;
  metronome.SetTempo(kBpm);
  metronome.SetTimeSignature(kNumerator, denominator);
  metronome.Start();
  ExpectEightBeatsAt(metronome, denominator, label);
}

// Same bpm, same numerator, four beat units. A denominator the scheduler
// ignored would make all four intervals equal; an inverted scale factor would
// swap 2 with 8 and 4 with 16.
void TestDenominatorSetsBeatInterval() {
  ExpectDenominatorSpacing(2, "7/2 at 90 BPM");
  ExpectDenominatorSpacing(4, "7/4 at 90 BPM");
  ExpectDenominatorSpacing(8, "7/8 at 90 BPM");
  ExpectDenominatorSpacing(16, "7/16 at 90 BPM");
}

// The bar is the numerator times the beat unit, so bar-mute's cycle must follow
// the denominator too — 7/8 at 90 BPM is a 112000-frame bar, not 224000.
void TestBarLengthFollowsDenominator() {
  constexpr int kBars = 4;
  kitbag::Metronome metronome;
  metronome.SetTempo(kBpm);
  metronome.SetTimeSignature(kNumerator, 8);
  metronome.SetBarMute(true, 1, 1);
  metronome.Start();

  const auto bar_frames =
      static_cast<int64_t>(BeatFrames(kBpm, 8)) * kNumerator;
  const auto onsets = RenderAndDetectOnsets(metronome, bar_frames * kBars);
  Check(onsets.size() == kNumerator * kBars / 2, "7/8 bar mute: 7 per bar");
  for (const int64_t onset : onsets) {
    Check(
        onset / bar_frames % 2 == 0,
        "7/8 bar mute: muted bars are 7 eighths long"
    );
  }
}

// 0, non-powers of two, out of range and negative all name no beat unit, so
// none of them may move the click off the eighth it is already on.
void TestInvalidDenominatorKeepsBeatUnit() {
  kitbag::Metronome metronome;
  metronome.SetTempo(kBpm);
  metronome.SetTimeSignature(kNumerator, 8);
  metronome.Start();
  for (const int invalid : {0, 3, 5, 6, 32, -8}) {
    metronome.SetTimeSignature(kNumerator, invalid);
  }
  ExpectEightBeatsAt(metronome, 8, "invalid denominator keeps 7/8");
}

// A rejected denominator must not latch: the next valid one still lands.
void TestValidDenominatorAfterInvalid() {
  kitbag::Metronome metronome;
  metronome.SetTempo(kBpm);
  metronome.SetTimeSignature(kNumerator, 3);
  metronome.SetTimeSignature(kNumerator, 16);
  metronome.Start();
  ExpectEightBeatsAt(metronome, 16, "valid after invalid: 7/16");
}

// The first block boundary at or after `frame` — where OnceAtFrame acts.
int64_t BlockBoundaryAtOrAfter(int64_t frame) {
  const auto block = static_cast<int64_t>(kBlockFrames);
  return (frame + block - 1) / block * block;
}

// Mid-beat, between the second and third clicks of the 4/4 run below.
constexpr int64_t kSwitchRequestFrame = 36000;

// Where the first click after the switch is due: the beat already in flight
// keeps the phase it had and only its remainder shrinks to the new beat unit.
double FirstOnsetAfterSwitch(int64_t switch_frame) {
  const double before = BeatFrames(kSwitchBpm, 4);
  const double phase =
      std::fmod(static_cast<double>(switch_frame), before) / before;
  return static_cast<double>(switch_frame) +
         (1.0 - phase) * BeatFrames(kSwitchBpm, 8);
}

constexpr int64_t kSwitchRunFrames = 96000;

void StartSwitchRun(kitbag::Metronome& metronome) {
  metronome.SetTempo(kSwitchBpm);
  metronome.SetTimeSignature(4, 4);
  metronome.Start();
}

auto SwitchToEighths(kitbag::Metronome& metronome, int64_t switch_frame) {
  return OnceAtFrame(switch_frame, [&metronome](int64_t) {
    metronome.SetTimeSignature(4, 8);
  });
}

// Measured as a gap, which cancels the detector's attack delay. 18048 frames:
// not 24000 (denominator ignored) and not 12000 (phase reset to the new unit).
void ExpectSwitchGap(const std::vector<int64_t>& onsets, int64_t switch_frame) {
  const double gap = static_cast<double>(onsets[2] - onsets[1]);
  const double expected =
      FirstOnsetAfterSwitch(switch_frame) - BeatFrames(kSwitchBpm, 4);
  Check(
      std::fabs(gap - expected) < kMaxJitterFrames,
      "switch: first new-unit click keeps the in-flight beat's phase"
  );
}

void TestMidRunSwitchMovesOnlyFutureClicks() {
  const int64_t switch_frame = BlockBoundaryAtOrAfter(kSwitchRequestFrame);
  kitbag::Metronome metronome;
  StartSwitchRun(metronome);

  const auto onsets = RenderContinuous(
      metronome,
      kSwitchRunFrames,
      SwitchToEighths(metronome, switch_frame)
  );
  // 0 and 24000 at the old unit, then 42048 and every 12000 to the end.
  Check(onsets.size() == 7, "denominator switch: no beat dropped or doubled");
  ExpectSpacing(onsets, 0, 2, BeatFrames(kSwitchBpm, 4), "switch: pre-switch");
  if (onsets.size() < 3) return;
  ExpectSwitchGap(onsets, switch_frame);
  ExpectSpacing(
      onsets,
      2,
      onsets.size(),
      BeatFrames(kSwitchBpm, 8),
      "switch: post-switch"
  );
}

// The onset detector merges anything inside its hold window, so a click re-fired
// at the switch would hide there. The block peak cannot hide it.
void TestMidRunSwitchDoesNotRefireAClick() {
  const int64_t switch_frame = BlockBoundaryAtOrAfter(kSwitchRequestFrame);
  kitbag::Metronome metronome;
  StartSwitchRun(metronome);

  const auto peaks = RenderContinuousPeaks(
      metronome,
      kSwitchRunFrames,
      SwitchToEighths(metronome, switch_frame)
  );
  const auto switch_block =
      static_cast<size_t>(switch_frame / static_cast<int64_t>(kBlockFrames));
  Check(peaks.size() > switch_block, "switch: rendered past the switch block");
  Check(
      peaks[switch_block] < kOnsetThreshold,
      "switch: no click fires on the denominator change itself"
  );
}

// Deliberately off the frame-0 grid, so a phase the anchor never asked for is
// visible rather than coincidentally right.
constexpr double kAnchorSongPos = 1.1;
constexpr int64_t kAnchorFrame = 12000;

// Anchored onsets straight from the contract: the song's beat 0 at song second
// 0, beats every (60 / bpm) * (4 / denominator) seconds.
std::vector<double>
AnchoredBeatSeconds(int denominator, int64_t total_frames, double early_sec) {
  std::vector<double> out;
  const double interval = BeatFrames(kSwitchBpm, denominator);
  for (int n = 0;; ++n) {
    const double frame = static_cast<double>(kAnchorFrame) + n * interval -
                         (kAnchorSongPos + early_sec) * kSampleRate;
    if (frame >= static_cast<double>(total_frames)) break;
    if (frame >= 0.0) out.push_back(frame / kSampleRate);
  }
  return out;
}

// An external anchor maps song seconds onto this signature's beat unit: at 120
// BPM the 8th-note click tracks the song every 0.25 s, not every 0.5 s.
void TestAnchorFollowsDenominator() {
  constexpr int64_t kTotalFrames = kSampleRate * 3;
  kitbag::Metronome metronome;
  metronome.SetTimeSignature(kNumerator, 8);
  metronome.AnchorExternal(kAnchorSongPos, kAnchorFrame, kSwitchBpm);

  const auto onsets = RenderAndDetectOnsets(metronome, kTotalFrames);
  ExpectOnsetsAtSeconds(
      onsets,
      AnchoredBeatSeconds(8, kTotalFrames, 0.0),
      "anchored 7/8"
  );
}

constexpr double kAnchorLatencyMs = 100.0;

void ExpectAnchorLatencyShift(int denominator, const char* label) {
  constexpr int64_t kTotalFrames = kSampleRate * 3;
  kitbag::Metronome metronome;
  metronome.SetTimeSignature(kNumerator, denominator);
  metronome.SetLatencyOffset(kAnchorLatencyMs);
  metronome.AnchorExternal(kAnchorSongPos, kAnchorFrame, kSwitchBpm);

  const auto onsets = RenderAndDetectOnsets(metronome, kTotalFrames);
  ExpectOnsetsAtSeconds(
      onsets,
      AnchoredBeatSeconds(denominator, kTotalFrames, kAnchorLatencyMs / 1000.0),
      label
  );
}

// Pre-compensation is fixed in seconds, so its width in beats must rescale with
// the beat unit. 7/2 and 7/8 bracket the quarter reference, and an unscaled
// offset misses in opposite directions: 0.2 s early in 7/2, 0.05 s in 7/8.
void TestAnchorLatencyIsDenominatorIndependent() {
  ExpectAnchorLatencyShift(2, "anchored 7/2, +100 ms");
  ExpectAnchorLatencyShift(8, "anchored 7/8, +100 ms");
}

}  // namespace

void RunSignatureTests() {
  TestFixtureIntervalsDiscriminate();
  TestDenominatorSetsBeatInterval();
  TestBarLengthFollowsDenominator();
  TestInvalidDenominatorKeepsBeatUnit();
  TestValidDenominatorAfterInvalid();
  TestMidRunSwitchMovesOnlyFutureClicks();
  TestMidRunSwitchDoesNotRefireAClick();
  TestAnchorFollowsDenominator();
  TestAnchorLatencyIsDenominatorIndependent();
}

}  // namespace metronome_test
