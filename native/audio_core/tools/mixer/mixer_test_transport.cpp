// Transport: what advances the read head and what stops it. Auto-stop follows
// the longest loaded track, never "nothing was audible this block" (SPEC §4.4).
#include "mixer_test_support.h"

namespace mixer_test {
namespace {

// Muting every track must not end playback, and the transport must keep
// running underneath the silence so unmuting resumes in sync.
void TestMuteAllKeepsPlaying() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);
  mixer.Play();
  mixer.SetMute(0, true);

  const std::vector<float> muted = RenderBlock(&mixer);
  Check(mixer.is_playing(), "mute-all: playback does not stop");
  ExpectSilentBlock(muted, "mute-all: the block is silent");
  Check(
      mixer.position() == kBlock,
      "mute-all: the transport advances while muted"
  );

  mixer.SetMute(0, false);
  const std::vector<float> heard = RenderBlock(&mixer);
  ExpectSample(
      heard,
      0,
      static_cast<float>(kBlock),
      "mute-all: unmute is audible at the resumed frame"
  );
  Check(mixer.position() == 2 * kBlock, "mute-all: unmute keeps advancing");
}

// Gain 0 is the same class of bug as mute: silent, but not the end of the song.
void TestZeroGainKeepsPlaying() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);
  LoadRamp(&mixer, 1, kLongFrames, kLongOffset);
  mixer.Play();
  mixer.SetGain(0, 0.0f);
  mixer.SetGain(1, 0.0f);

  const std::vector<float> out = RenderBlock(&mixer);
  Check(mixer.is_playing(), "zero-gain: playback does not stop");
  ExpectSilentBlock(out, "zero-gain: the block is silent");
  Check(mixer.position() == kBlock, "zero-gain: the transport advances");
}

// The short stem is soloed, so the mix runs dry at frame 1000 while the long
// stem still has data. Solo gates the mix, never the transport.
void TestSoloKeepsPlayingForOthers() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kShortFrames, 0.0f);
  LoadRamp(&mixer, 1, kLongFrames, kLongOffset);
  mixer.Play();
  mixer.SetSolo(0, true);
  mixer.Seek(900);

  const std::vector<float> soloed = RenderBlock(&mixer);
  ExpectSample(soloed, 3, 903.0f, "solo: only the soloed track is heard");
  Check(mixer.position() == 1412, "solo: the transport advances");

  const std::vector<float> dry = RenderBlock(&mixer);
  Check(mixer.is_playing(), "solo: the soloed stem running out does not stop");
  ExpectSilentBlock(dry, "solo: the mix is dry past the soloed stem's end");
  Check(mixer.position() == 1924, "solo: the transport runs past the dry mix");

  mixer.SetSolo(0, false);
  const std::vector<float> both = RenderBlock(&mixer);
  ExpectSample(
      both,
      0,
      kLongOffset + 1924.0f,
      "solo: un-soloing restores the long stem at the live frame"
  );
}

// Auto-stop fires only once the read head passes the longest track's end, and
// the final partial block still sounds.
void TestAutoStopAtLongestTrackEnd() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kShortFrames, 0.0f);
  LoadRamp(&mixer, 1, kLongFrames, kLongOffset);
  mixer.Play();
  mixer.Seek(kLongFrames - 400);

  const std::vector<float> tail = RenderBlock(&mixer);
  ExpectSample(
      tail,
      399,
      kLongOffset + static_cast<float>(kLongFrames - 1),
      "auto-stop: the last frame still sounds"
  );
  ExpectSample(tail, 400, 0.0f, "auto-stop: past the end is silent");
  Check(mixer.is_playing(), "auto-stop: the finishing block still plays");
  Check(
      mixer.position() == kLongFrames,
      "auto-stop: the head clamps to the longest track's end"
  );

  RenderBlock(&mixer);
  Check(!mixer.is_playing(), "auto-stop: the next block ends playback");
  Check(
      mixer.position() == kLongFrames,
      "auto-stop: the head stays at the end"
  );
}

// The short stem running out must not disturb the long one. Advancing by the
// minimum would step 900 -> 1000 -> 1512, replaying 412 frames of the long
// stem every block. Do not "fix" this back to a minimum (SPEC.md §4.4).
void TestShortStemDoesNotHoldBackTheLongOne() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kShortFrames, 0.0f);
  LoadRamp(&mixer, 1, kLongFrames, kLongOffset);
  mixer.Play();
  mixer.Seek(900);

  RenderBlock(&mixer);
  Check(mixer.position() == 1412, "unequal stems: first block ends at 1412");
  const std::vector<float> second = RenderBlock(&mixer);
  Check(mixer.position() == 1924, "unequal stems: second block ends at 1924");
  ExpectSample(
      second,
      0,
      kLongOffset + 1412.0f,
      "unequal stems: the long stem continues rather than replaying"
  );
}

// Seek, position and Stop are transport state and unchanged by the fix.
void TestSeekAndPosition() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kLongFrames, kLongOffset);
  mixer.Seek(1234);
  Check(mixer.position() == 1234, "seek: position reports the sought frame");

  mixer.Play();
  const std::vector<float> out = RenderBlock(&mixer);
  ExpectSample(
      out,
      0,
      kLongOffset + 1234.0f,
      "seek: playback resumes at the sought frame"
  );
  Check(mixer.position() == 1234 + kBlock, "seek: the head advances one block");

  mixer.Stop();
  Check(!mixer.is_playing(), "stop: playback ends");
  Check(mixer.position() == 0, "stop: the head rewinds to zero");
}

// Pause holds the head where it stopped; Stop rewinds it. Resuming after a
// Pause must sound from the held frame, not from the top (SPEC.md §4.4).
void TestPauseHoldsPositionStopRewinds() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kLongFrames, kLongOffset);
  const uint64_t sought = 1234;
  const uint64_t held = sought + kBlock;
  mixer.Seek(sought);
  mixer.Play();
  RenderBlock(&mixer);

  mixer.Pause();
  Check(!mixer.is_playing(), "pause: playback ends");
  Check(mixer.position() == held, "pause: the head holds its position");
  ExpectSilentBlock(RenderBlock(&mixer), "pause: a paused mixer is silent");
  Check(mixer.position() == held, "pause: a paused block does not advance");

  mixer.Play();
  const std::vector<float> resumed = RenderBlock(&mixer);
  ExpectSample(
      resumed,
      0,
      kLongOffset + static_cast<float>(held),
      "pause: resuming sounds from the held frame"
  );
  Check(
      mixer.position() == held + kBlock,
      "pause: resuming advances exactly one block from the held frame"
  );

  mixer.Stop();
  Check(mixer.position() == 0, "pause: Stop still rewinds after a Pause");
}

}  // namespace

void RunTransportTests() {
  TestMuteAllKeepsPlaying();
  TestZeroGainKeepsPlaying();
  TestSoloKeepsPlayingForOthers();
  TestAutoStopAtLongestTrackEnd();
  TestShortStemDoesNotHoldBackTheLongOne();
  TestSeekAndPosition();
  TestPauseHoldsPositionStopRewinds();
}

}  // namespace mixer_test
