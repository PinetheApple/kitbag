#include <chrono>
#include <cmath>
#include <iterator>
#include <thread>

#include "pulse_stem.h"
#include "stem_sync_rate.h"

namespace stem_sync {
namespace {

constexpr double kFirstBeat = 12001.3;
constexpr double kSpacings[] = {19877.4, 21209.9, 18013.2, 20999.7, 19777.1};
constexpr int64_t kSongTailFrames = 12000;
constexpr float kSilence = 1e-2f;
constexpr int64_t kGapFrames = 480;
// Offline pulls outrun the read-ahead thread; this stays ~20x realtime.
constexpr auto kPacePerBlock = std::chrono::microseconds(500);

}  // namespace

std::vector<double> Beats() {
  std::vector<double> beats;
  double at = kFirstBeat;
  for (int i = 0; i < kBeatCount; ++i) {
    beats.push_back(at);
    at += kSpacings[static_cast<size_t>(i) % std::size(kSpacings)];
  }
  return beats;
}

int64_t SongFrames() {
  return static_cast<int64_t>(Beats().back()) + kSongTailFrames;
}

std::string WritePulseStem() {
  const std::string path = media_test::UniqueTempPath("kitbag_stem_rate");
  return media_test::WritePulseStemWav(path, Beats(), SongFrames(), kRate)
             ? path
             : "";
}

kb_engine* OpenFollowingEngine(const std::string& stem) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  std::vector<double> times;
  for (double beat : Beats()) times.push_back(beat / kRate);
  kb_mixer_load_track(engine, 0, stem.c_str());
  kb_metronome_set_grid(
      engine,
      times.data(),
      static_cast<int32_t>(times.size()),
      0
  );
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  return engine;
}

void RenderPaced(kb_engine* engine, Take* take, int blocks) {
  std::vector<float> out(static_cast<size_t>(kBlock) * kStereo);
  for (int b = 0; b < blocks; ++b) {
    kb_engine_render(engine, out.data(), kBlock);
    std::this_thread::sleep_for(kPacePerBlock);
    for (uint32_t f = 0; f < kBlock; ++f) {
      take->left.push_back(out[kStereo * f]);
      take->right.push_back(out[kStereo * f + 1]);
    }
  }
}

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

}  // namespace stem_sync
