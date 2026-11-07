#include <chrono>
#include <iterator>
#include <thread>

#include "stem_pulse.h"
#include "stem_sync_rate.h"

namespace stem_sync {
namespace {

constexpr double kFirstBeat = 12001.3;
constexpr double kSpacings[] = {19877.4, 21209.9, 18013.2, 20999.7, 19777.1};
constexpr int64_t kSongTailFrames = 12000;
// Offline pulls outrun the read-ahead thread.
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
  return media_test::WritePulseStemWav(path, Beats(), SongFrames(), kSampleRate)
             ? path
             : "";
}

kb_engine* OpenFollowingEngine(const std::string& stem) {
  std::vector<double> seconds;
  for (double beat : Beats()) seconds.push_back(beat / kSampleRate);
  return media_test::OpenFollowingEngine(stem, seconds);
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

}  // namespace stem_sync
