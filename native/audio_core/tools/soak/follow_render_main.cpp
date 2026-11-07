#include "kitbag_api.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <string>
#include <thread>
#include <vector>

#include "render_exit.h"
#include "stem_pulse.h"
#include "wav_fixture.h"

namespace {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kStereo = 2;
constexpr uint32_t kMono = 1;
// Prime, so no slowed rate scales a block to whole frames.
constexpr uint32_t kBlockFrames = 251;
constexpr double kMeanBeatSeconds = 60.0 / 117.0;
// Non-constant tempo (SPEC.md §6.5): spacing swings on a period of no whole
// number of beats, so a constant-tempo click cannot pass for the grid.
constexpr double kTempoSwing = 0.04;
constexpr double kSwingPerBeat = 0.37;
constexpr double kFirstBeatSeconds = 0.2371;
constexpr double kEndMarginSeconds = 1.0;
// Offline pulls outrun the read-ahead thread, so a stem would underrun.
constexpr auto kPacePerBlock = std::chrono::microseconds(250);
constexpr int kGridDigits = 9;

using click_soak::RenderExit;

std::vector<double> SongBeats(double song_seconds) {
  std::vector<double> beats;
  double at = kFirstBeatSeconds;
  for (int i = 0; at < song_seconds - kEndMarginSeconds; ++i) {
    beats.push_back(at);
    at += kMeanBeatSeconds * (1.0 + kTempoSwing * std::sin(i * kSwingPerBeat));
  }
  return beats;
}

std::vector<float> RenderClickChannel(kb_engine* engine, double out_seconds) {
  const auto total = static_cast<uint64_t>(out_seconds * kSampleRate);
  std::vector<float> block(static_cast<size_t>(kBlockFrames) * kStereo);
  std::vector<float> clicks;
  clicks.reserve(total);
  for (uint64_t done = 0; done < total; done += kBlockFrames) {
    kb_engine_render(engine, block.data(), kBlockFrames);
    std::this_thread::sleep_for(kPacePerBlock);
    for (uint32_t f = 0; f < kBlockFrames; ++f) {
      clicks.push_back(block[static_cast<size_t>(f) * kStereo + 1]);
    }
  }
  return clicks;
}

bool WriteGrid(
    const std::string& path,
    const std::vector<double>& beats,
    double rate
) {
  std::ofstream grid(path);
  grid << std::fixed << std::setprecision(kGridDigits);
  for (double beat : beats) grid << beat / rate << '\n';
  return static_cast<bool>(grid);
}

bool RenderClicks(
    const std::string& stem,
    const std::vector<double>& beats,
    double rate,
    double song_seconds,
    std::vector<float>* clicks
) {
  kb_engine* engine = media_test::OpenFollowingEngine(stem, beats);
  if (engine == nullptr) return false;
  const bool rendered =
      kb_mixer_set_rate(engine, static_cast<float>(rate)) == KB_OK;
  if (rendered) {
    kb_mixer_play(engine);
    *clicks = RenderClickChannel(engine, song_seconds / rate);
  }
  kb_engine_destroy(engine);
  return rendered;
}

bool Render(
    const std::string& wav,
    const std::string& grid,
    double rate,
    double song_seconds
) {
  const std::vector<double> beats = SongBeats(song_seconds);
  std::vector<double> beat_frames;
  for (double beat : beats) beat_frames.push_back(beat * kSampleRate);
  const std::string stem = wav + ".stem.wav";
  const auto frames = static_cast<int64_t>(song_seconds * kSampleRate);
  if (!media_test::WritePulseStemWav(stem, beat_frames, frames, kSampleRate)) {
    return false;
  }
  std::vector<float> clicks;
  const bool rendered = RenderClicks(stem, beats, rate, song_seconds, &clicks);
  std::filesystem::remove(stem);
  return rendered &&
         media_test::WriteFloatWav(wav, clicks, kMono, kSampleRate) &&
         WriteGrid(grid, beats, rate);
}

int Usage() {
  std::fprintf(
      stderr,
      "usage: follow_render <out.wav> <out-grid.txt> <rate> <song-seconds>\n"
      "Renders the engine's click following a stem at <rate> through the C "
      "ABI\n"
      "(mono %u Hz float WAV), and that song's grid in the recording's own\n"
      "timeline, for click_soak --grid (SPEC.md 6.5, 7.6).\n",
      kSampleRate
  );
  return static_cast<int>(RenderExit::kUsage);
}

}  // namespace

int main(int argc, char** argv) {
  constexpr int kArgCount = 5;
  if (argc != kArgCount) return Usage();
  const double rate = std::strtod(argv[3], nullptr);
  const double song_seconds = std::strtod(argv[4], nullptr);
  if (rate <= 0.0 || song_seconds <= 0.0) return Usage();
  if (!Render(argv[1], argv[2], rate, song_seconds)) {
    std::fprintf(stderr, "follow_render: render failed\n");
    return static_cast<int>(RenderExit::kFailed);
  }
  return static_cast<int>(RenderExit::kWritten);
}
