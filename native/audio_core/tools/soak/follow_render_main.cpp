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

#include "pulse_stem.h"
#include "wav_fixture.h"

namespace {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kStereo = 2;
constexpr uint32_t kMono = 1;
// Prime, so no rate under test scales a block to whole frames.
constexpr uint32_t kBlockFrames = 251;
constexpr double kMeanBeatSeconds = 60.0 / 117.0;
// Non-constant tempo (SPEC.md §6.5): spacing swings 4% on a period of no whole
// number of beats, so a constant-tempo click cannot pass for the grid.
constexpr double kTempoSwing = 0.04;
constexpr double kSwingPerBeat = 0.37;
constexpr double kFirstBeatSeconds = 0.2371;
constexpr double kEndMarginSeconds = 1.0;
// Offline pulls outrun the read-ahead thread, so a stem would underrun.
constexpr auto kPacePerBlock = std::chrono::microseconds(250);
constexpr int kGridDigits = 9;

// Outside click_soak's 0-5, as metronome_render's are.
enum class RenderExit : int { kWritten = 0, kUsage = 2, kFailed = 8 };

std::vector<double> SongBeats(double song_seconds) {
  std::vector<double> beats;
  double at = kFirstBeatSeconds;
  for (int i = 0; at < song_seconds - kEndMarginSeconds; ++i) {
    beats.push_back(at);
    at += kMeanBeatSeconds * (1.0 + kTempoSwing * std::sin(i * kSwingPerBeat));
  }
  return beats;
}

kb_engine*
OpenEngine(const std::string& stem, const std::vector<double>& beats) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  if (kb_mixer_load_track(engine, 0, stem.c_str()) != KB_OK ||
      kb_metronome_set_grid(
          engine,
          beats.data(),
          static_cast<int32_t>(beats.size()),
          0
      ) != KB_OK) {
    kb_engine_destroy(engine);
    return nullptr;
  }
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  return engine;
}

// The right channel: the stem is left only, so this is the click over a live
// stretch, as a cable from the output would hear it with the stem panned away.
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
  kb_engine* engine = OpenEngine(stem, beats);
  if (engine == nullptr ||
      kb_mixer_set_rate(engine, static_cast<float>(rate)) != KB_OK) {
    return false;
  }
  kb_mixer_play(engine);
  const std::vector<float> clicks =
      RenderClickChannel(engine, song_seconds / rate);
  kb_engine_destroy(engine);
  std::filesystem::remove(stem);
  return media_test::WriteFloatWav(wav, clicks, kMono, kSampleRate) &&
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
