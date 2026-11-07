#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <iterator>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "mixer/transport_plan.h"
#include "stem_pulse.h"
#include "stem_sync_rate.h"

namespace stem_sync {
namespace {

using kitbag_test::Check;

// Well under the stretch latency this guards (over 60 ms); what is left is the
// vocoder's smear of a pulse's centre.
constexpr double kMaxLockMs = 1.5;
constexpr double kMaxDriftMs = 0.2;
constexpr double kMsPerSecond = 1000.0;
constexpr int64_t kSongWindowFrames = 9000;
constexpr int kTailBlocks = 2;

struct LockCase {
  double rate;
  int32_t semitones;
};
constexpr size_t kPulseStems = 2;
constexpr double kChangeFromRate = 0.75;
constexpr double kChangeToRate = 0.5;
// Midway between two pulses: a change up to ~58 ms before a beat moved that beat's
// 60 ms pulse by -9 ms slowing, +7.4 ms speeding, one beat only; the click stays.
constexpr int kBlocksBeforeChange = 961;
constexpr int32_t kFiveKeys[] = {-2, 3, 1, 4, -5};
constexpr double kFiveKeyRates[] = {0.75, kitbag::kUnityRate};
constexpr LockCase kCases[] =
    {{0.5, 0}, {0.75, 0}, {kitbag::kUnityRate, 3}, {0.75, -2}};

double PulseCentre(const Take& take, int64_t around, int64_t half_width) {
  double weight = 0.0;
  double moment = 0.0;
  const auto size = static_cast<int64_t>(take.left.size());
  const int64_t from = std::max<int64_t>(around - half_width, 0);
  for (int64_t k = from; k < std::min(around + half_width, size); ++k) {
    const auto i = static_cast<size_t>(k);
    const double stem = take.left[i] - take.right[i];
    weight += stem * stem;
    moment += stem * stem * static_cast<double>(k);
  }
  return weight > 0.0 ? moment / weight : -1.0;
}

Take PlaySong(kb_engine* engine, double rate) {
  Take take;
  kb_mixer_play(engine);
  const double out_frames = static_cast<double>(SongFrames()) / rate;
  RenderPaced(
      engine,
      &take,
      static_cast<int>(out_frames / kBlock) - kTailBlocks
  );
  return take;
}

Take RenderSong(const std::string& stem, const LockCase& lock) {
  kb_engine* engine = OpenFollowingEngine(stem);
  if (engine == nullptr) return {};
  kb_mixer_set_rate(engine, static_cast<float>(lock.rate));
  if (lock.semitones != 0) {
    kb_mixer_set_track_pitch(engine, 0, lock.semitones);
  }
  Take take = PlaySong(engine, lock.rate);
  kb_engine_destroy(engine);
  return take;
}

std::vector<int64_t> EveryBeatClick(const Take& take, const std::string& name) {
  std::vector<int64_t> clicks = click_take::DetectClicks(take.right);
  const bool whole = clicks.size() == static_cast<size_t>(kBeatCount);
  Check(whole, (name + ": every beat clicks once").c_str());
  if (whole) return clicks;
  std::fprintf(stderr, "  %zu clicks, want %d\n", clicks.size(), kBeatCount);
  return {};
}

// Pulses are centred on their beats, so the stem's centre of energy is where
// the song puts the beat, however the vocoder widens the pulse.
std::vector<double>
ClickOffsetsMs(const Take& take, double slowest_rate, const std::string& name) {
  const std::vector<int64_t> clicks = EveryBeatClick(take, name);
  std::vector<double> offsets;
  const auto half_width =
      static_cast<int64_t>(kSongWindowFrames / slowest_rate);
  for (const int64_t click : clicks) {
    const double offset =
        PulseCentre(take, click, half_width) - static_cast<double>(click);
    offsets.push_back(offset / kSampleRate * kMsPerSecond);
  }
  return offsets;
}

void CheckOnPulses(
    const std::vector<double>& offsets,
    const std::string& name
) {
  double worst = 0.0;
  for (const double offset : offsets) {
    worst = std::max(worst, std::fabs(offset));
  }
  Check(worst <= kMaxLockMs, (name + ": each click sits on its pulse").c_str());
  if (worst > kMaxLockMs) std::fprintf(stderr, "  worst %.3f ms\n", worst);
}

// Keys widen a pulse differently, so drift compares each stem with itself.
void CheckNoDrift(
    const std::vector<double>& offsets,
    size_t stems,
    const std::string& name
) {
  if (offsets.size() < stems) return;
  double drift = 0.0;
  const size_t tail = offsets.size() - stems;
  for (size_t k = 0; k < stems; ++k) {
    drift = std::max(drift, std::fabs(offsets[tail + k] - offsets[k]));
  }
  Check(drift <= kMaxDriftMs, (name + ": no drift across the song").c_str());
  if (drift > kMaxDriftMs) std::fprintf(stderr, "  drift %.3f ms\n", drift);
}

void TestClickLockedToStem(const std::string& stem, const LockCase& lock) {
  const std::string name = "lock " + std::to_string(lock.rate) + "x " +
                           std::to_string(lock.semitones) + " st";
  const std::vector<double> offsets =
      ClickOffsetsMs(RenderSong(stem, lock), lock.rate, name);
  CheckOnPulses(offsets, name);
  CheckNoDrift(offsets, 1, name);
}

std::string WriteStemOf(const std::vector<double>& beats, int index) {
  const std::string path =
      media_test::UniqueTempPath("kitbag_stem_key_" + std::to_string(index));
  return media_test::WritePulseStemWav(path, beats, SongFrames(), kSampleRate)
             ? path
             : "";
}

// Each pulse stem sits on its own bus; five keys pass the chosen config's limit.
std::vector<std::string> WriteFiveKeyStems() {
  std::vector<double> pulses[kPulseStems];
  const std::vector<double> beats = Beats();
  for (size_t b = 0; b < beats.size(); ++b) {
    pulses[b % kPulseStems].push_back(beats[b]);
  }
  std::vector<std::string> paths;
  for (size_t t = 0; t < std::size(kFiveKeys); ++t) {
    paths.push_back(WriteStemOf(
        t < std::size(pulses) ? pulses[t] : std::vector<double>{},
        static_cast<int>(t)
    ));
  }
  return paths;
}

kb_engine* OpenFiveKeys(const std::vector<std::string>& stems, double rate) {
  kb_engine* engine = OpenFollowingEngine(stems[0]);
  if (engine == nullptr) return nullptr;
  kb_mixer_set_rate(engine, static_cast<float>(rate));
  for (size_t t = 0; t < stems.size(); ++t) {
    const auto track = static_cast<int32_t>(t);
    if (t > 0) kb_mixer_load_track(engine, track, stems[t].c_str());
    kb_mixer_set_track_pitch(engine, track, kFiveKeys[t]);
  }
  return engine;
}

void TestClickLockedAcrossFiveKeys(
    const std::vector<std::string>& stems,
    double rate
) {
  kb_engine* engine = OpenFiveKeys(stems, rate);
  if (engine == nullptr) return;
  const std::string name = "lock five keys " + std::to_string(rate) + "x";
  const Take take = PlaySong(engine, rate);
  kb_engine_destroy(engine);
  const std::vector<double> offsets = ClickOffsetsMs(take, rate, name);
  CheckOnPulses(offsets, name);
  CheckNoDrift(offsets, kPulseStems, name);
}

// At one rate the input and output latency cancel in the song-frame mapping; a
// change is where the buses' own latency, not the chosen config's, must count.
void TestClickLockedAcrossARateChange(const std::vector<std::string>& stems) {
  kb_engine* engine = OpenFiveKeys(stems, kChangeFromRate);
  if (engine == nullptr) return;
  Take take;
  kb_mixer_play(engine);
  RenderPaced(engine, &take, kBlocksBeforeChange);
  kb_mixer_set_rate(engine, static_cast<float>(kChangeToRate));
  const double song_left =
      static_cast<double>(SongFrames()) -
      kChangeFromRate * kBlock * static_cast<double>(kBlocksBeforeChange);
  const auto out_left = static_cast<int>(song_left / kChangeToRate / kBlock);
  RenderPaced(engine, &take, out_left - kTailBlocks);
  kb_engine_destroy(engine);
  const std::string name = "lock five keys across a change";
  CheckOnPulses(ClickOffsetsMs(take, kChangeToRate, name), name);
}

}  // namespace

void RunLockTests(const std::string& stem) {
  for (const LockCase& lock : kCases) TestClickLockedToStem(stem, lock);
  const std::vector<std::string> stems = WriteFiveKeyStems();
  for (double rate : kFiveKeyRates) TestClickLockedAcrossFiveKeys(stems, rate);
  TestClickLockedAcrossARateChange(stems);
  for (const std::string& path : stems) std::filesystem::remove(path);
}

}  // namespace stem_sync
