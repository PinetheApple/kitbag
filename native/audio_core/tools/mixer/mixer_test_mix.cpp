// Mixing: what lands in the buffer. Stems shorter than the longest sum while
// they last, then pad with silence rather than dropping out (SPEC.md §4.4).
#include "mixer_test_support.h"

namespace mixer_test {
namespace {

// A stem shorter than the longest contributes silence past its end, not a
// dropped voice and not stale samples. The block straddles frame 1000, so one
// render covers both sides of the boundary.
void TestShortStemIsZeroPaddedNotDropped() {
  kitbag::Mixer mixer;
  LoadRamp(&mixer, 0, kShortFrames, 0.0f);
  LoadRamp(&mixer, 1, kLongFrames, kLongOffset);
  mixer.Play();
  mixer.Seek(900);

  const std::vector<float> out = RenderBlock(&mixer);
  // Sums, so dropping the short stem shows up as 100900 rather than 101800.
  ExpectSample(out, 0, 101800.0f, "zero-pad: both stems sum before the end");
  ExpectSample(out, 99, 101998.0f, "zero-pad: the short stem's last frame");
  ExpectSample(
      out,
      100,
      101000.0f,
      "zero-pad: the long stem alone one frame on"
  );
  ExpectSample(
      out,
      400,
      101300.0f,
      "zero-pad: still long-only well past the end"
  );
  Check(mixer.is_playing(), "zero-pad: the short stem ending does not stop");
}

// Padding is MixTrack's job for both paths, but MixStereo reaches the frame
// through a channels-strided index, so its boundary is its own to get wrong.
void TestShortStereoStemIsZeroPadded() {
  kitbag::Mixer mixer;
  const std::vector<float> stereo = MakeRamp(kShortFrames * kStereo, 0.0f);
  mixer.SetTrackData(0, stereo.data(), kShortFrames, kStereo, kSampleRate);
  LoadRamp(&mixer, 1, kLongFrames, kLongOffset);
  mixer.Play();
  mixer.Seek(900);

  // Interleaved, so frame 999 is pcm[1998] left and pcm[1999] right. The mono
  // stem adds 100999 to both, preserving that gap — a right-only fault shows.
  const std::vector<float> out = RenderBlock(&mixer);
  ExpectSample(out, 99, 1998.0f + 100999.0f, "zero-pad stereo: last frame");
  ExpectSample(out, 100, 101000.0f, "zero-pad stereo: padded one frame on");
  ExpectChannel(
      out,
      99,
      1,
      1999.0f + 100999.0f,
      "zero-pad stereo: last frame, right channel"
  );
  ExpectChannel(
      out,
      100,
      1,
      101000.0f,
      "zero-pad stereo: padded one frame on, right channel"
  );
}

// Process must clear the buffer before mixing: Engine::Render renders the
// additive metronome into it afterwards and relies on that.
void TestProcessClearsTheBuffer() {
  kitbag::Mixer mixer;
  std::vector<float> out(kBlock * 2, 7.0f);
  mixer.Process(out.data(), kBlock, kSampleRate);
  ExpectSilentBlock(out, "memset: a stopped mixer clears the buffer");
}

}  // namespace

void RunMixTests() {
  TestShortStemIsZeroPaddedNotDropped();
  TestShortStereoStemIsZeroPadded();
  TestProcessClearsTheBuffer();
}

}  // namespace mixer_test
