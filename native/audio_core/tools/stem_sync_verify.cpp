// Stem: song-frame ramp left, silence right. So right is the click alone, and
// left minus right is the song frame the stems played when it sounded.
#include "kitbag_api.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <thread>
#include <vector>

#include "check.h"
#include "wav_fixture.h"

namespace {

using kitbag_test::Check;
using kitbag_test::g_checks;
using kitbag_test::g_failures;

constexpr int kExpectedChecks = 19;
constexpr uint32_t kRate = 48000;
constexpr uint32_t kBlock = 512;
constexpr int64_t kStemFrames = 240000;
// Uneven spacing, so a click on a constant tempo cannot pass for the grid.
constexpr int64_t kBeats[] = {
    3001,
    21877,
    41209,
    60013,
    79501,
    98777,
    118211,
    137503,
    156881,
    176303,
    195601,
    215009
};
constexpr int64_t kLoopStart = 41209;
constexpr int64_t kLoopEnd = 79501;
constexpr int kExpectedClicks = 15;
// The last block before the pause holds beat 118211, so a click clock that
// kept running while paused would sound it again.
constexpr int64_t kPauseSeek = 87700;
// Long enough for the last click before the pause to ring down below kSilence.
constexpr int kPauseBlocks = 20;
constexpr double kLatencyMs = 20.3;
// 20.3 ms at 48 kHz is 974.4 frames; beats sit on whole frames, so each click
// moves exactly 974 frames earlier.
constexpr int64_t kLatencyShift = 974;
constexpr float kSilence = 1e-2f;
constexpr int64_t kGapFrames = 480;
constexpr double kHalfFrame = 0.5;
// Offline pulls outrun the read-ahead thread, and an underrun is silence in the
// stem the clicks are measured against; 1 ms is still ~10x realtime.
constexpr auto kPacePerBlock = std::chrono::milliseconds(1);

struct Model {
  int64_t song = 0;
  bool playing = false;
  bool looping = false;
};

struct Take {
  std::vector<float> left;
  std::vector<float> right;
  std::vector<int64_t> song;
  size_t pause_end = 0;
};

void Render(kb_engine* engine, Model* model, Take* take, int blocks) {
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  for (int b = 0; b < blocks; ++b) {
    kb_engine_render(engine, out.data(), kBlock);
    std::this_thread::sleep_for(kPacePerBlock);
    for (uint32_t f = 0; f < kBlock; ++f) {
      take->left.push_back(out[2 * f]);
      take->right.push_back(out[2 * f + 1]);
      if (model->looping && model->song == kLoopEnd) model->song = kLoopStart;
      take->song.push_back(model->playing ? model->song : -1);
      if (model->playing) ++model->song;
    }
  }
}

std::string WriteStem() {
  std::vector<float> pcm(static_cast<size_t>(kStemFrames) * 2, 0.0f);
  for (int64_t i = 0; i < kStemFrames; ++i) {
    pcm[2 * i] = static_cast<float>(i);
  }
  const auto path =
      std::filesystem::temp_directory_path() / "kitbag_stem_sync.wav";
  if (!media_test::WriteFloatWav(path.string(), pcm, 2, kRate)) return "";
  return path.string();
}

kb_engine* OpenEngine(const std::string& stem, double latency_ms) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  std::vector<double> times;
  for (int64_t beat : kBeats) {
    times.push_back(static_cast<double>(beat) / kRate);
  }
  kb_mixer_load_track(engine, 0, stem.c_str());
  kb_metronome_set_grid(
      engine,
      times.data(),
      static_cast<int32_t>(times.size()),
      0
  );
  kb_metronome_set_latency_offset(engine, latency_ms);
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  return engine;
}

void Seek(kb_engine* engine, Model* model, int64_t frame) {
  kb_mixer_seek(engine, frame);
  model->song = frame;
}

// Play, seek, pause and resume, then three loop wraps, then a clear mid-pass.
Take RunScript(kb_engine* engine) {
  Model model;
  Take take;
  kb_mixer_play(engine);
  model.playing = true;
  Render(engine, &model, &take, 60);
  Seek(engine, &model, kPauseSeek);
  Render(engine, &model, &take, 60);
  kb_mixer_pause(engine);
  model.playing = false;
  Render(engine, &model, &take, kPauseBlocks);
  take.pause_end = take.right.size();
  kb_mixer_play(engine);
  model.playing = true;
  Render(engine, &model, &take, 70);
  Seek(engine, &model, 30000);
  kb_mixer_set_loop(engine, kLoopStart, kLoopEnd);
  model.looping = true;
  Render(engine, &model, &take, 300);
  kb_mixer_clear_loop(engine);
  model.looping = false;
  Render(engine, &model, &take, 60);
  return take;
}

bool IsBeat(int64_t song) {
  for (int64_t beat : kBeats) {
    if (beat == song) return true;
  }
  return false;
}

std::vector<int64_t> ExpectedClicks(const Take& take) {
  std::vector<int64_t> clicks;
  for (size_t k = 0; k < take.song.size(); ++k) {
    if (take.song[k] >= 0 && IsBeat(take.song[k])) clicks.push_back(k);
  }
  return clicks;
}

// A voice starts at phase zero, so its trigger frame is the silent one before
// the first audible sample.
std::vector<int64_t> DetectClicks(const std::vector<float>& right) {
  std::vector<int64_t> clicks;
  int64_t quiet = kGapFrames;
  for (size_t k = 0; k < right.size(); ++k) {
    if (std::fabs(right[k]) <= kSilence) {
      ++quiet;
      continue;
    }
    if (quiet >= kGapFrames) clicks.push_back(static_cast<int64_t>(k) - 1);
    quiet = 0;
  }
  return clicks;
}

bool SameClicks(
    const std::vector<int64_t>& got,
    const std::vector<int64_t>& want,
    int64_t shift
) {
  bool same = got.size() == want.size();
  for (size_t i = 0; i < got.size() && i < want.size(); ++i) {
    if (got[i] == want[i] - shift) continue;
    std::fprintf(
        stderr,
        "  click %zu at %lld, expected %lld\n",
        i,
        (long long)got[i],
        (long long)(want[i] - shift)
    );
    same = false;
  }
  if (got.size() != want.size()) {
    std::fprintf(
        stderr,
        "  %zu clicks, expected %zu\n",
        got.size(),
        want.size()
    );
  }
  return same;
}

// The loop-start beat sounds inside the wrap's crossfade, where the left
// channel is a blend rather than one song frame, so it is left to the model.
bool ClicksSitOnTheStem(const Take& take, const std::vector<int64_t>& clicks) {
  int checked = 0;
  for (int64_t k : clicks) {
    if (take.song[k] == kLoopStart) continue;
    const double stem = take.left[k] - take.right[k];
    if (std::fabs(stem - static_cast<double>(take.song[k])) > kHalfFrame) {
      std::fprintf(stderr, "  click at %lld: stem %.2f\n", (long long)k, stem);
      return false;
    }
    ++checked;
  }
  return checked > 0;
}

// A retrigger inside a ringing click has no silent gap for DetectClicks to see,
// so a paused clock that kept firing shows as the click never dying away.
bool QuietAtPauseEnd(const Take& take) {
  float loudest = 0.0f;
  for (size_t k = take.pause_end - kBlock; k < take.pause_end; ++k) {
    loudest = std::max(loudest, std::fabs(take.right[k]));
  }
  return loudest <= kSilence;
}

void TestClickFollowsTheStems(const std::string& stem) {
  kb_engine* engine = OpenEngine(stem, 0.0);
  Check(engine != nullptr, "sync: engine opens");
  if (engine == nullptr) return;
  const Take take = RunScript(engine);
  kb_engine_destroy(engine);
  const std::vector<int64_t> want = ExpectedClicks(take);
  const std::vector<int64_t> got = DetectClicks(take.right);
  Check(want.size() == kExpectedClicks, "sync: the script crosses 15 beats");
  Check(SameClicks(got, want, 0), "sync: every click lands on its grid frame");
  Check(
      ClicksSitOnTheStem(take, got),
      "sync: the stem plays that beat's frame"
  );
  Check(QuietAtPauseEnd(take), "sync: no click re-sounds while paused");

  engine = OpenEngine(stem, kLatencyMs);
  if (engine == nullptr) return;
  const Take early = RunScript(engine);
  kb_engine_destroy(engine);
  Check(
      SameClicks(DetectClicks(early.right), want, kLatencyShift),
      "sync: the latency offset moves every click 974 frames earlier"
  );
}

void TestFollowOffKeepsTheAnchor(const std::string& stem) {
  kb_engine* engine = OpenEngine(stem, 0.0);
  if (engine == nullptr) return;
  kb_metronome_follow_mixer(engine, 0);
  Model model;
  Take take;
  Render(engine, &model, &take, 60);
  kb_engine_destroy(engine);
  const std::vector<int64_t> got = DetectClicks(take.right);
  Check(
      got.size() == 2 && got[0] == kBeats[0] && got[1] == kBeats[1],
      "anchor: with follow off the grid runs from anchor frame 0, stems idle"
  );
}

void TestLoopAbi(kb_engine* engine);

void TestMixerAbi(const std::string& stem) {
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "abi: engine opens");
  if (engine == nullptr) return;
  Check(kb_mixer_gain(engine, 5) == 1.0f, "abi: an unloaded track's gain is 1");
  Check(kb_mixer_master_gain(engine) == 1.0f, "abi: master gain defaults to 1");
  kb_mixer_set_master_gain(engine, 0.4f);
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  kb_engine_render(engine, out.data(), kBlock);
  Check(kb_mixer_master_gain(engine) == 0.4f, "abi: master gain applies");
  kb_mixer_load_track(engine, 0, stem.c_str());
  TestLoopAbi(engine);
  kb_engine_destroy(engine);
}

void TestLoopAbi(kb_engine* engine) {
  Check(
      kb_mixer_set_loop(engine, kLoopEnd, kLoopStart) ==
          KB_ERROR_INVALID_ARGUMENT,
      "abi: an inverted loop is rejected"
  );
  Check(
      kb_mixer_set_loop(engine, 0, kStemFrames + 1) ==
          KB_ERROR_INVALID_ARGUMENT,
      "abi: a loop past the end is rejected"
  );
  Check(
      kb_mixer_set_loop(engine, kLoopStart, kLoopEnd) == KB_OK,
      "abi: loop set"
  );
  Check(kb_mixer_clear_loop(engine) == KB_OK, "abi: loop cleared");
  Check(
      kb_mixer_set_loop(nullptr, 0, 1) == KB_ERROR_INVALID_ARGUMENT,
      "abi: null"
  );
  Check(
      kb_mixer_clear_loop(nullptr) == KB_ERROR_INVALID_ARGUMENT,
      "abi: null clear"
  );
  kb_mixer_set_master_gain(nullptr, 1.0f);
  kb_metronome_follow_mixer(nullptr, 1);
  Check(kb_mixer_master_gain(nullptr) == 0.0f, "abi: null master gain is 0");
}

}  // namespace

int main() {
  const std::string stem = WriteStem();
  Check(!stem.empty(), "fixture: the stem WAV writes");
  if (!stem.empty()) {
    TestClickFollowsTheStems(stem);
    TestFollowOffKeepsTheAnchor(stem);
    TestMixerAbi(stem);
    std::filesystem::remove(stem);
  }
  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "stem_sync_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures != 0) {
    std::fprintf(stderr, "stem_sync_verify: %d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("stem_sync_verify: all checks passed\n");
  return 0;
}
