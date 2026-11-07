#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr float kKeyA = 3.0f;
constexpr float kKeyB = 1.0f;
constexpr float kKeyMove = 2.0f;
constexpr int64_t kSongFrames = int64_t{4} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate / 2 + 7;
constexpr int64_t kBurstAfterSeek = 40011;
constexpr int64_t kSilentLead = kSampleRate + 11;
constexpr int64_t kSilenceFrames = int64_t{3} * kSampleRate / 5;
constexpr int64_t kToneTailFrames = kSampleRate / 5;
constexpr float kRelativeOnset = 0.5f;
constexpr int64_t kStaleBurstAfterSeek = 30011;
constexpr int kMuteAtBlock = 60;
constexpr int kUnmuteAtBlock = 150;
constexpr int kStaleTailBlocks = 120;
constexpr float kStaleThreshold = 0.05f;
constexpr int kJoinAtBlock = 20;
constexpr int64_t kDrainSong = 5 * kSampleRate / 2;
constexpr int64_t kDrainSeekBack = kSampleRate;
constexpr int64_t kDrainBurstBeforeEnd = 9001;
constexpr int64_t kDrainBurstFrames = 6000;
constexpr int kMaxDrainBlocks = 400;
constexpr double kLowHz = 220.0;
constexpr double kHighHz = 330.0;
constexpr float kHalf = 0.25f;
constexpr float kUnloadKey = 4.0f;
constexpr int64_t kUnloadToneFrames = int64_t{2} * kSampleRate;
constexpr int kMoveAtBlock = 60;
constexpr int64_t kMoveLoopStart = 20011;
constexpr int64_t kMoveLoopEnd = 47123;
constexpr int64_t kMoveLoopFrom = 40000;
constexpr int64_t kClockBurst = 33013;
constexpr int64_t kClockFrom = 25013;
constexpr int kClockMaxBlocks = 400;

struct Stem {
  std::vector<float> pcm;
  float key = 0.0f;
};

int BlocksFor(int64_t output_frames) {
  return static_cast<int>(output_frames / kBlock) + 2;
}

std::vector<float> RenderAlone(
    const std::vector<Stem>& stems,
    int heard,
    int64_t burst_after_seek
) {
  kitbag::Mixer mixer(kSampleRate);
  for (size_t t = 0; t < stems.size(); ++t) {
    LoadPcm(&mixer, static_cast<int>(t), stems[t].pcm);
    mixer.SetTrackPitch(static_cast<int>(t), stems[t].key, 0, false);
    mixer.SetMute(static_cast<int>(t), static_cast<int>(t) != heard);
  }
  mixer.SetRate(kSpeed, 0, false);
  mixer.Seek(kSeekTo, 0, false);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, 1);
  CheckNear(
      static_cast<int64_t>(mixer.position()),
      kSeekTo + static_cast<int64_t>(kSpeed * kBlock),
      1,
      "prime: the position starts at the target, no snap-back"
  );
  const int64_t audible = OutputFramesFor(burst_after_seek, kSpeed);
  const std::vector<float> rest =
      RenderPaced(&mixer, BlocksFor(audible + kBurstFrames));
  left.insert(left.end(), rest.begin(), rest.end());
  return left;
}

int64_t OnsetAfter(const std::vector<float>& left, int64_t from) {
  const float peak = Loudest(left, from, static_cast<int64_t>(left.size()));
  return FirstAbove(left, kRelativeOnset * peak, from);
}

void CheckOnsetsMatch(
    const std::vector<Stem>& stems,
    int64_t burst_after_seek,
    const char* label,
    int64_t from = 0
) {
  const int64_t a = OnsetAfter(RenderAlone(stems, 0, burst_after_seek), from);
  const int64_t b = OnsetAfter(RenderAlone(stems, 1, burst_after_seek), from);
  std::printf(
      "mixer_verify: %s onsets %lld / %lld, expected %lld\n",
      label,
      static_cast<long long>(a),
      static_cast<long long>(b),
      static_cast<long long>(OutputFramesFor(burst_after_seek, kSpeed))
  );
  CheckNear(a, b, kOnsetToleranceFrames, label);
  CheckNear(
      a,
      OutputFramesFor(burst_after_seek, kSpeed),
      kOnsetToleranceFrames,
      label
  );
}

void TestEqualLagAcrossBuses() {
  const std::vector<float> pcm = ToneFixture(
      {.frames = kSongFrames, .burst_at = kSeekTo + kBurstAfterSeek}
  );
  CheckOnsetsMatch(
      {{pcm, 0.0f}, {pcm, kKeyA}},
      kBurstAfterSeek,
      "lag: 0 st and +3 st buses land one transient together"
  );
}

void TestSilencePathKeepsOnset() {
  const int64_t burst = kSeekTo + kSilentLead;
  const std::vector<float> bed =
      ToneFixture({.frames = kSongFrames, .burst_at = burst, .bed = true});
  std::vector<float> silent =
      ToneFixture({.frames = kSongFrames, .burst_at = burst});
  const std::vector<float> lead =
      ToneFixture({.frames = burst - kSilenceFrames, .steady_hz = kHighHz});
  std::copy(lead.begin(), lead.end(), silent.begin());
  CheckOnsetsMatch(
      {{bed, 0.0f}, {silent, kKeyB}},
      kSilentLead,
      "silence: audio, 0.6 s of digital silence, then a transient on time",
      OutputFramesFor(kSilentLead - kSilenceFrames + kToneTailFrames, kSpeed)
  );
}

void TestMuteNeverReplaysStaleAudio() {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(
      &mixer,
      0,
      ToneFixture(
          {.frames = kSongFrames, .burst_at = kSeekTo + kStaleBurstAfterSeek}
      )
  );
  mixer.SetRate(kSpeed, 0, false);
  mixer.Seek(kSeekTo, 0, false);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, kMuteAtBlock);
  mixer.SetMute(0, true);
  const std::vector<float> muted =
      RenderPaced(&mixer, kUnmuteAtBlock - kMuteAtBlock);
  left.insert(left.end(), muted.begin(), muted.end());
  mixer.SetMute(0, false);
  const std::vector<float> tail = RenderPaced(&mixer, kStaleTailBlocks);
  CheckNear(
      FirstAbove(left, kOnsetThreshold),
      OutputFramesFor(kStaleBurstAfterSeek, kSpeed),
      kOnsetToleranceFrames,
      "mute: audio fed before the mute still plays at its frame"
  );
  const float stale = Loudest(tail, 0, static_cast<int64_t>(tail.size()));
  Check(stale < kStaleThreshold, "mute: unmuting replays nothing stale");
  if (stale >= kStaleThreshold) {
    std::fprintf(stderr, "  stale peak %.3f\n", static_cast<double>(stale));
  }
}

int64_t LateJoinOnset(const std::vector<float>& pcm, int heard) {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(&mixer, 0, pcm);
  mixer.SetTrackPitch(0, kKeyA, 0, false);
  mixer.SetMute(0, heard != 0);
  mixer.SetRate(kSpeed, 0, false);
  mixer.Seek(kSeekTo, 0, false);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, kJoinAtBlock);
  LoadPcm(&mixer, 1, pcm);
  mixer.SetMute(1, heard != 1);
  const int64_t audible = OutputFramesFor(kBurstAfterSeek, kSpeed);
  const std::vector<float> rest = RenderPaced(&mixer, BlocksFor(audible));
  left.insert(left.end(), rest.begin(), rest.end());
  return FirstAbove(left, kOnsetThreshold);
}

void TestLateLoadedStemJoinsAligned() {
  const std::vector<float> pcm = ToneFixture(
      {.frames = kSongFrames, .burst_at = kSeekTo + kBurstAfterSeek}
  );
  const int64_t playing = LateJoinOnset(pcm, 0);
  const int64_t joined = LateJoinOnset(pcm, 1);
  CheckNear(
      joined,
      playing,
      kOnsetToleranceFrames,
      "join: a stem loaded mid-play into a new bus lands with the others"
  );
}

std::vector<float> RenderUntilStopped(kitbag::Mixer* mixer) {
  std::vector<float> left;
  for (int b = 0; b < kMaxDrainBlocks && (b == 0 || mixer->is_playing()); ++b) {
    const std::vector<float> block = RenderPaced(mixer, 1);
    left.insert(left.end(), block.begin(), block.end());
  }
  return left;
}

void CheckStoppedAtEnd(const kitbag::Mixer& mixer) {
  Check(!mixer.is_playing(), "end: playback stops");
  Check(
      mixer.position() == static_cast<uint64_t>(kDrainSong),
      "end: the head rests at the song's end"
  );
}

void TestEndOfSongDrains() {
  const int64_t burst = kDrainSong - kDrainBurstBeforeEnd;
  kitbag::Mixer mixer(kSampleRate);
  const ToneSpec song{
      .frames = kDrainSong,
      .burst_at = burst,
      .burst_frames = kDrainBurstFrames
  };
  LoadPcm(&mixer, 0, ToneFixture(song));
  mixer.SetRate(kSpeed, 0, false);
  const int64_t from = kDrainSong - kDrainSeekBack;
  mixer.Seek(from, 0, false);
  mixer.Play();
  const std::vector<float> left = RenderUntilStopped(&mixer);
  CheckNear(
      FirstAbove(left, kOnsetThreshold),
      OutputFramesFor(burst - from, kSpeed),
      kOnsetToleranceFrames,
      "end: a transient in the last lag of the song is still heard"
  );
  CheckNear(
      static_cast<int64_t>(left.size()),
      OutputFramesFor(kDrainSeekBack, kSpeed),
      int64_t{2} * kBlock,
      "end: auto-stop fires at the audible end, not the fed end"
  );
  CheckStoppedAtEnd(mixer);
}

std::vector<std::vector<float>> TwoTones() {
  return {
      ToneFixture(
          {.frames = kSongFrames,
           .steady_hz = kLowHz,
           .steady_amplitude = kHalf}
      ),
      ToneFixture(
          {.frames = kSongFrames,
           .steady_hz = kHighHz,
           .steady_amplitude = kHalf}
      ),
  };
}

void CheckMoveClick(std::initializer_list<float> keys, const char* label) {
  const std::vector<std::vector<float>> stems = TwoTones();
  const float budget = LoopWrapCurvature(
      stems,
      {.start = kMoveLoopStart, .end = kMoveLoopEnd, .from = kMoveLoopFrom}
  );
  kitbag::Mixer mixer(kSampleRate);
  for (int t : {0, 1}) LoadPcm(&mixer, t, stems[t]);
  mixer.SetRate(kSpeed, 0, false);
  mixer.Play();
  std::vector<float> left = RenderPaced(&mixer, kMoveAtBlock);
  const auto moved = static_cast<int64_t>(left.size());
  for (const float key : keys) mixer.SetTrackPitch(1, key, 0, false);
  const int64_t settle = 2 * OutputFramesFor(LagFrames(kSpeed), kSpeed);
  const std::vector<float> after = RenderPaced(&mixer, BlocksFor(settle));
  left.insert(left.end(), after.begin(), after.end());
  const float click = PeakCurvature(left, moved, moved + settle);
  std::printf(
      "mixer_verify: %s: curvature %.5f, loop crossfade %.5f\n",
      label,
      static_cast<double>(click),
      static_cast<double>(budget)
  );
  Check(click <= budget, label);
}

void TestBusMoveDoesNotClick() {
  CheckMoveClick(
      {kKeyMove},
      "move: a key change clicks no more than a loop wrap"
  );
  CheckMoveClick(
      {kKeyB, kKeyMove},
      "move: two key changes in one block click no more than a loop wrap"
  );
}

void PlayIntoSecondPass(kitbag::Mixer* mixer) {
  const int64_t clear_at = kClockBurst - LagFrames(kSpeed) / 2;
  uint64_t last = mixer->position();
  bool wrapped = false;
  for (int b = 0; b < kClockMaxBlocks; ++b) {
    RenderPaced(mixer, 1);
    wrapped = wrapped || mixer->position() < last;
    last = mixer->position();
    if (wrapped && static_cast<int64_t>(last) >= clear_at) return;
  }
}

void TestClockMapsInFlightFramesByTheirLayout() {
  kitbag::Mixer mixer(kSampleRate);
  LoadPcm(
      &mixer,
      0,
      ToneFixture({.frames = kSongFrames, .burst_at = kClockBurst})
  );
  mixer.SetRate(kSpeed, 0, false);
  mixer.SetLoop(kMoveLoopStart, kMoveLoopEnd, 0, false);
  mixer.Seek(kClockFrom, 0, false);
  mixer.Play();
  PlayIntoSecondPass(&mixer);
  mixer.ClearLoop(0, false);
  const int blocks = BlocksFor(OutputFramesFor(LagFrames(kSpeed), kSpeed));
  CheckNear(
      SongFrameAtOnset(&mixer, blocks),
      kClockBurst,
      kOnsetToleranceFrames,
      "clock: a frame fed before a loop clear keeps its loop's song frame"
  );
}

void TestUnloadResetsTheKey() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kUnloadToneFrames);
  mixer.SetTrackPitch(0, kUnloadKey, 0, false);
  RenderPaced(&mixer, 1);
  mixer.UnloadTrack(0, 0, false);
  RenderPaced(&mixer, 1);
  Check(mixer.track_pitch(0) == 0, "unload: the key mirror reads 0");
  LoadTone(&mixer, kUnloadToneFrames);
  RenderPaced(&mixer, 1);
  Check(mixer.track_pitch(0) == 0, "unload: the next stem starts at 0 st");
  mixer.Seek(0, 0, false);
  Check(mixer.key_bus_count() == 0, "unload: the next stem needs no bus");
}

// The queue cannot carry the reset, so the app side must not claim it either.
void TestUnloadOnFullQueueKeepsBothSidesAgreed() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kUnloadToneFrames);
  mixer.SetTrackPitch(0, kUnloadKey, 0, false);
  RenderPaced(&mixer, 1);
  const uint64_t before = mixer.dropped_commands();
  while (mixer.dropped_commands() == before) mixer.SetGain(0, 1.0f);
  mixer.UnloadTrack(0, 0, false);
  RenderPaced(&mixer, 1);
  LoadTone(&mixer, kUnloadToneFrames);
  mixer.Seek(0, 0, false);
  Check(
      mixer.track_pitch(0) == static_cast<int>(kUnloadKey) &&
          mixer.key_bus_count() == 1,
      "unload: a full queue leaves the key on both sides"
  );
}

}  // namespace

void RunKeyBusTests() {
  TestUnloadResetsTheKey();
  TestUnloadOnFullQueueKeepsBothSidesAgreed();
  TestEqualLagAcrossBuses();
  TestSilencePathKeepsOnset();
  TestMuteNeverReplaysStaleAudio();
  TestLateLoadedStemJoinsAligned();
  TestEndOfSongDrains();
  TestBusMoveDoesNotClick();
  TestClockMapsInFlightFramesByTheirLayout();
}

}  // namespace mixer_test
