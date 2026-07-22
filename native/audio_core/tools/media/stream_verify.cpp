// Streams a real audio file through the native playback path entirely across the
// flat C ABI — kb_player_load -> kb_player_play -> kb_engine_render — the way a
// host will, and asserts three things end to end: the exact frame count streams,
// the streamed output is not silence, and a file at a non-engine rate resamples
// to the right engine-rate length and still sounds (A6, issue #11, SPEC.md §4.1).
// No C++ internals are touched: the interface is the test surface. Fixtures are
// temp WAVs written through the real file path, like the mixer/player tools.
#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "wav_fixture.h"

namespace {

int g_failures = 0;
// Counted so a deleted TestX() call cannot pass silently; update deliberately.
int g_checks = 0;
constexpr int kExpectedChecks = 12;

void Check(bool condition, const char* message) {
  ++g_checks;
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

constexpr uint32_t kBlock = 512;
constexpr uint32_t kEngineRate = 48000;
constexpr float kAudibleFloor = 0.5f;

// A file whose length is not a multiple of the block, so the transport landing
// exactly on it — rather than rounded up to a block boundary — is the signal.
constexpr uint64_t kExactFrames = 17003;

// 30000 frames at 44.1k resample to ~32653 at 48k. The window is tight enough to
// exclude the 30000-frame input (a skipped resample) yet absorbs the linear
// converter's held-tail frame (resampling_source_reader.cpp).
constexpr uint32_t kResampleRate = 44100;
constexpr uint64_t kResampleInFrames = 30000;
constexpr uint64_t kResampleOutLow = 32650;
constexpr uint64_t kResampleOutHigh = 32654;

// Values in [0.1, 0.9]: a DC-offset sine that never touches zero, so even one
// streamed frame is unambiguously non-silent and the peak clears kAudibleFloor.
bool WriteTone(const std::string& path, uint64_t frames, uint32_t rate) {
  std::vector<float> pcm(frames);
  for (uint64_t i = 0; i < frames; ++i) {
    const double t = static_cast<double>(i) / rate;
    pcm[i] = 0.5f +
             0.4f * static_cast<float>(std::sin(2.0 * 3.14159265 * 220.0 * t));
  }
  return media_test::WriteFloatWav(path, pcm, 1, rate);
}

struct StreamStats {
  uint64_t blocks = 0;
  float peak = 0.0f;
};

// Pulls blocks through the ABI until the player stops. The first render drains
// the queued Play (is_playing only flips once the callback sees it), so the loop
// is do/while. Bounded so a transport that never stops cannot hang CI.
StreamStats StreamToEnd(kb_engine* engine, uint64_t total_frames) {
  std::vector<float> buf(static_cast<size_t>(kBlock) * 2);
  const uint64_t max_blocks = total_frames / kBlock + 16;
  StreamStats stats;
  do {
    kb_engine_render(engine, buf.data(), kBlock);
    for (float s : buf) {
      const float a = std::fabs(s);
      if (a > stats.peak) stats.peak = a;
    }
    ++stats.blocks;
  } while (kb_player_is_playing(engine) != 0 && stats.blocks < max_blocks);
  return stats;
}

std::string TempPath(const char* tag) {
  return (std::filesystem::temp_directory_path() /
          (std::string("kitbag_stream_") + tag + ".wav"))
      .string();
}

// A fresh engine has no source, so a pulled block must come back silent: it
// proves the render actually clears the buffer rather than leaking scratch.
void TestFreshEngineRendersSilence(kb_engine* engine) {
  std::vector<float> buf(static_cast<size_t>(kBlock) * 2, 1.0f);
  kb_engine_render(engine, buf.data(), kBlock);
  bool silent = true;
  for (float s : buf) silent = silent && s == 0.0f;
  Check(silent, "render: a sourceless engine pulls silence");
}

// Assertion 1 (exact frame count) and 2 (non-silence): stream a 48k file, so no
// resampling changes the length, and assert every frame clocks out and sounds.
void TestExactFrameCountAndNonSilence(
    kb_engine* engine,
    const std::string& path
) {
  Check(kb_player_load(engine, path.c_str()) == KB_OK, "exact: the WAV loads");
  Check(
      kb_player_frames(engine) == static_cast<int64_t>(kExactFrames),
      "exact: frames() reports the file's frame count"
  );

  kb_player_play(engine);
  const StreamStats stats = StreamToEnd(engine, kExactFrames);

  Check(kb_player_is_playing(engine) == 0, "exact: playback stops at the end");
  Check(
      kb_player_position(engine) == static_cast<int64_t>(kExactFrames),
      "exact: exactly the file's frame count streamed, not a block-rounded "
      "total"
  );
  Check(stats.peak > kAudibleFloor, "non-silence: the streamed output sounds");
  kb_player_unload(engine);
}

// Assertion 3 (resample correctness): a 44.1k file streams to the correct 48k
// frame count and is non-silent, all across the ABI.
void TestResampleCorrectness(kb_engine* engine, const std::string& path) {
  Check(
      kb_player_load(engine, path.c_str()) == KB_OK,
      "resample: the WAV loads"
  );
  const int64_t frames = kb_player_frames(engine);
  Check(
      frames >= static_cast<int64_t>(kResampleOutLow) &&
          frames <= static_cast<int64_t>(kResampleOutHigh),
      "resample: frames() is the 48k count, not the 44.1k input"
  );

  kb_player_play(engine);
  const StreamStats stats = StreamToEnd(engine, kResampleOutHigh);

  Check(
      kb_player_is_playing(engine) == 0,
      "resample: playback stops at the end"
  );
  Check(
      kb_player_position(engine) == frames,
      "resample: the whole resampled length streams"
  );
  Check(stats.peak > kAudibleFloor, "resample: the resampled output sounds");
  kb_player_unload(engine);
}

int Report() {
  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "stream_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures == 0) {
    std::printf("stream_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "stream_verify: %d failure(s)\n", g_failures);
  return 1;
}

}  // namespace

int main() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK || engine == nullptr) {
    std::fprintf(stderr, "stream_verify: could not create an engine\n");
    return 1;
  }
  Check(
      kb_engine_sample_rate(engine) == kEngineRate,
      "engine: the offline path runs at the fixed engine rate"
  );

  const std::string exact = TempPath("exact");
  const std::string resample = TempPath("resample");
  if (!WriteTone(exact, kExactFrames, kEngineRate) ||
      !WriteTone(resample, kResampleInFrames, kResampleRate)) {
    std::fprintf(stderr, "stream_verify: could not write a fixture\n");
    kb_engine_destroy(engine);
    return 1;
  }

  TestFreshEngineRendersSilence(engine);
  TestExactFrameCountAndNonSilence(engine, exact);
  TestResampleCorrectness(engine, resample);

  std::error_code ec;
  std::filesystem::remove(exact, ec);
  std::filesystem::remove(resample, ec);
  kb_engine_destroy(engine);
  return Report();
}
