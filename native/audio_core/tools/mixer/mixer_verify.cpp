// Pins the mixer transport: auto-stop follows the longest loaded track, never
// "nothing was audible this block" (SPEC.md §4.4).
#include <cstdio>
#include <vector>

#include "mixer/mixer.h"

namespace {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kBlock = 512;
constexpr uint32_t kMono = 1;
constexpr uint64_t kShortFrames = 1000;
constexpr uint64_t kLongFrames = 5000;
// Keeps the two stems' samples apart by more than any frame index in play, so a
// mixed sample names the track it came from as well as its source frame.
constexpr float kLongOffset = 100000.0f;
constexpr float kEpsilon = 0.001f;

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

// pcm[i] = offset + i, so a mixed sample reveals exactly which source frame
// landed where — the only way to tell advancing from replaying.
std::vector<float> MakeRamp(uint64_t frames, float offset) {
  std::vector<float> pcm(frames);
  for (uint64_t i = 0; i < frames; ++i) {
    pcm[i] = offset + static_cast<float>(i);
  }
  return pcm;
}

void LoadRamp(kitbag::Mixer* mixer, int track, uint64_t frames, float offset) {
  const std::vector<float> pcm = MakeRamp(frames, offset);
  mixer->SetTrackData(track, pcm.data(), frames, kMono, kSampleRate);
}

std::vector<float> RenderBlock(kitbag::Mixer* mixer) {
  std::vector<float> out(kBlock * 2, -1.0f);
  mixer->Process(out.data(), kBlock, kSampleRate);
  return out;
}

// Asserts the buffer is long enough itself: a helper that iterates over the
// actual output passes vacuously when the output is empty.
void ExpectSample(
    const std::vector<float>& out,
    uint32_t frame,
    float expected,
    const char* label
) {
  Check(out.size() >= static_cast<size_t>(frame + 1) * 2, label);
  if (out.size() < static_cast<size_t>(frame + 1) * 2) return;
  const float got = out[static_cast<size_t>(frame) * 2];
  ++g_checks;
  if (got < expected - kEpsilon || got > expected + kEpsilon) {
    std::fprintf(
        stderr,
        "FAIL: %s — frame %u = %.3f, expected %.3f\n",
        label,
        frame,
        static_cast<double>(got),
        static_cast<double>(expected)
    );
    ++g_failures;
  }
}

void ExpectSilentBlock(const std::vector<float>& out, const char* label) {
  Check(out.size() == static_cast<size_t>(kBlock) * 2, label);
  if (out.size() != static_cast<size_t>(kBlock) * 2) return;
  for (size_t i = 0; i < out.size(); ++i) {
    if (out[i] != 0.0f) {
      std::fprintf(
          stderr,
          "FAIL: %s — sample %zu = %.3f, expected silence\n",
          label,
          i,
          static_cast<double>(out[i])
      );
      ++g_failures;
      return;
    }
  }
}

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

// Process must clear the buffer before mixing: Engine::Render renders the
// additive metronome into it afterwards and relies on that.
void TestProcessClearsTheBuffer() {
  kitbag::Mixer mixer;
  std::vector<float> out(kBlock * 2, 7.0f);
  mixer.Process(out.data(), kBlock, kSampleRate);
  ExpectSilentBlock(out, "memset: a stopped mixer clears the buffer");
}

}  // namespace

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 36;

int main() {
  TestMuteAllKeepsPlaying();
  TestZeroGainKeepsPlaying();
  TestSoloKeepsPlayingForOthers();
  TestAutoStopAtLongestTrackEnd();
  TestShortStemDoesNotHoldBackTheLongOne();
  TestSeekAndPosition();
  TestProcessClearsTheBuffer();

  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "mixer_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures == 0) {
    std::printf("mixer_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "mixer_verify: %d failure(s)\n", g_failures);
  return 1;
}
