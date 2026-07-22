// Offline player verification: drives Player::Render without a device and
// asserts the single-source transport — position advances while playing, pause
// holds it, seek moves it, the source drains in order (advancing, not
// replaying), and Render accumulates rather than assigns (the #17 render-seam
// contract). Sources load from real temp WAVs through the file adapter, so the
// frame-count and resample paths are the shipped ones.
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "check.h"
#include "player/player.h"
#include "wav_fixture.h"

namespace {

using kitbag::Player;
using kitbag_test::Check;

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kBlock = 512;
constexpr uint64_t kLongFrames = 5000;
// Offset keeps ramp values far from any frame index in play, so a sample names
// the source frame it came from and advancing is distinguishable from replaying.
constexpr float kOffset = 100000.0f;
constexpr float kEpsilon = 0.01f;

// Temp WAVs a streaming source reads lazily, so each must outlive its player;
// removed at suite end rather than per-test.
std::vector<std::string>& TempFiles() {
  static std::vector<std::string> files;
  return files;
}

std::string NextTempPath() {
  static std::atomic<uint64_t> counter{0};
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() /
      ("kitbag_player_" + std::to_string(counter.fetch_add(1)) + ".wav");
  return path.string();
}

// pcm[i] = offset + i, so a rendered sample reveals exactly which source frame
// landed where — the only way to tell advancing from replaying.
bool WriteMonoRamp(
    const std::string& path,
    uint64_t frames,
    float offset,
    uint32_t rate
) {
  std::vector<float> pcm(frames);
  for (uint64_t i = 0; i < frames; ++i) pcm[i] = offset + static_cast<float>(i);
  return media_test::WriteFloatWav(path, pcm, 1, rate);
}

// Loads a mono ramp of [frames] at [rate] into [player] through the real file
// path. now_frame 0 / engine_running false: the suite drives Render by hand, so
// no callback is concurrent.
bool LoadRamp(Player* player, uint64_t frames, float offset, uint32_t rate) {
  const std::string path = NextTempPath();
  if (!WriteMonoRamp(path, frames, offset, rate)) return false;
  TempFiles().push_back(path);
  return player->Load(path.c_str(), 0, false);
}

// Renders one block into a buffer pre-filled with [fill], so a test can assert
// both the mixed values and that silence leaves the fill untouched.
std::vector<float> RenderBlock(Player* player, float fill) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2, fill);
  player->Render(out.data(), kBlock);
  return out;
}

void ExpectNear(
    const std::vector<float>& out,
    uint32_t frame,
    uint32_t channel,
    float expected,
    const char* label
) {
  const size_t idx = static_cast<size_t>(frame) * 2 + channel;
  Check(out.size() > idx, label);
  if (out.size() <= idx) return;
  Check(
      out[idx] > expected - kEpsilon && out[idx] < expected + kEpsilon,
      label
  );
}

void CleanupTempFiles() {
  std::error_code ec;
  for (const std::string& path : TempFiles()) {
    std::filesystem::remove(path, ec);
  }
  TempFiles().clear();
}

void TestLoadReadyFramesUnload() {
  Player player(kSampleRate);
  Check(!player.ready(), "load: a fresh player is not ready");
  Check(LoadRamp(&player, kLongFrames, kOffset, kSampleRate), "load: real WAV");
  Check(player.ready(), "load: ready once the source is published");
  Check(player.frames() == kLongFrames, "load: frames() reports the length");

  player.Unload(0, false);
  Check(!player.ready(), "unload: the retired player is no longer ready");
  Check(player.frames() == 0, "unload: frames() drops to 0");
}

void TestPositionAdvances() {
  Player player(kSampleRate);
  Check(LoadRamp(&player, kLongFrames, kOffset, kSampleRate), "advance: load");
  player.Play();

  const std::vector<float> b1 = RenderBlock(&player, 0.0f);
  Check(player.position() == kBlock, "advance: position += block after play");
  ExpectNear(b1, 0, 0, kOffset, "advance: block1 frame0 == ramp[0]");
  ExpectNear(
      b1,
      0,
      1,
      kOffset,
      "advance: mono duplicated to the right channel"
  );
  ExpectNear(b1, kBlock - 1, 0, kOffset + (kBlock - 1), "advance: block1 tail");

  const std::vector<float> b2 = RenderBlock(&player, 0.0f);
  Check(player.position() == 2 * kBlock, "advance: position += block again");
  ExpectNear(
      b2,
      0,
      0,
      kOffset + kBlock,
      "advance: block2 continues (not replay)"
  );
}

void TestPauseHolds() {
  Player player(kSampleRate);
  Check(LoadRamp(&player, kLongFrames, kOffset, kSampleRate), "pause: load");
  player.Play();
  RenderBlock(&player, 0.0f);  // position -> kBlock

  player.Pause();
  const std::vector<float> paused = RenderBlock(&player, 0.25f);
  Check(player.position() == kBlock, "pause: position holds across the block");
  Check(!player.is_playing(), "pause: is_playing clears");
  Check(paused[0] == 0.25f && paused[1] == 0.25f, "pause: the block is silent");

  player.Play();
  const std::vector<float> resumed = RenderBlock(&player, 0.0f);
  ExpectNear(
      resumed,
      0,
      0,
      kOffset + kBlock,
      "pause: resumes at the held frame"
  );
  Check(
      player.position() == 2 * kBlock,
      "pause: resume advances from the hold"
  );
}

void TestSeek() {
  Player player(kSampleRate);
  Check(LoadRamp(&player, kLongFrames, kOffset, kSampleRate), "seek: load");
  player.Play();
  RenderBlock(&player, 0.0f);

  player.Seek(2000);
  const std::vector<float> after = RenderBlock(&player, 0.0f);
  ExpectNear(after, 0, 0, kOffset + 2000, "seek: reads from the sought frame");
  Check(player.position() == 2000 + kBlock, "seek: position tracks the seek");
}

void TestAccumulateNotAssign() {
  Player player(kSampleRate);
  Check(LoadRamp(&player, kLongFrames, 10.0f, kSampleRate), "accumulate: load");
  player.Play();

  const std::vector<float> out = RenderBlock(&player, 0.25f);
  ExpectNear(
      out,
      0,
      0,
      0.25f + 10.0f,
      "accumulate: adds onto the buffer (left)"
  );
  ExpectNear(
      out,
      0,
      1,
      0.25f + 10.0f,
      "accumulate: adds onto the buffer (right)"
  );
}

void TestEndOfSourceStops() {
  Player player(kSampleRate);
  Check(
      LoadRamp(&player, 700, kOffset, kSampleRate),
      "end: load a short source"
  );
  player.Play();
  player.Seek(600);
  RenderBlock(&player, 0.0f);  // 600 -> clamps to 700 (source end)
  RenderBlock(&player, 0.0f);  // start >= length: transport stops
  Check(!player.is_playing(), "end: playback stops at the source end");
  Check(player.position() == 700, "end: position clamps at the length");
}

void TestResampleOnLoad() {
  Player player(kSampleRate);
  // 44.1kHz in: BuildSource resamples to 48kHz, so the length grows ~48/44.1.
  Check(
      LoadRamp(&player, 4410, kOffset, 44100),
      "resample: load a 44.1k source"
  );
  Check(player.ready(), "resample: ready after the resampling load");
  const uint64_t got = player.frames();
  Check(got > 4700 && got < 4900, "resample: length scales to the engine rate");

  player.Play();
  const std::vector<float> out = RenderBlock(&player, 0.0f);
  bool nonsilent = false;
  for (float s : out) nonsilent = nonsilent || s != 0.0f;
  Check(nonsilent, "resample: the resampled source renders non-silence");
}

void TestNullAndEmpty() {
  Player player(kSampleRate);
  Check(!player.Load(nullptr, 0, false), "empty: a null path is rejected");
  Check(
      !player.Load("/nonexistent/kitbag.wav", 0, false),
      "empty: a file that will not open is rejected"
  );
  Check(player.position() == 0, "empty: a fresh player rests at frame 0");
  Check(!player.is_playing(), "empty: a fresh player is not playing");

  // Transport on a sourceless player must not crash and must not wedge playing.
  player.Play();
  player.Seek(100);
  player.Pause();
  std::vector<float> out(static_cast<size_t>(kBlock) * 2, 0.0f);
  player.Render(out.data(), kBlock);
  Check(
      !player.is_playing(),
      "empty: transport on a sourceless player is safe"
  );
}

constexpr int kExpectedChecks = 45;

int Report() {
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "player_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("player_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "player_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}

}  // namespace

int main() {
  TestLoadReadyFramesUnload();
  TestPositionAdvances();
  TestPauseHolds();
  TestSeek();
  TestAccumulateNotAssign();
  TestEndOfSourceStops();
  TestResampleOnLoad();
  TestNullAndEmpty();
  CleanupTempFiles();
  return Report();
}
