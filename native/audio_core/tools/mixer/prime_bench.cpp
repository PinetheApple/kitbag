#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <memory>
#include <numbers>
#include <random>
#include <string>
#include <thread>
#include <vector>

#include "mixer/key_bus.h"
#include "mixer/mixer.h"
#include "stretch/time_stretch.h"
#include "wav_fixture.h"

namespace {

using Clock = std::chrono::steady_clock;

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kChannels = 2;
constexpr uint32_t kBlock = 512;
constexpr int kStems = kitbag::Mixer::kMaxTracks;
constexpr uint64_t kSongFrames = 20ULL * kSampleRate;
constexpr int kBusCounts[] = {
    1,
    kitbag::TimeStretch::kMaxChosenConfigInstances,
    kitbag::Mixer::kKeyBusCount
};
constexpr float kSpeed = 0.75f;
constexpr int kSteadyBlocks = 400;
constexpr int kEventRepeats = 8;
constexpr int kEventBlocks = 3;
constexpr int kSettleBlocks = 20;
constexpr uint64_t kSeekStride = 2ULL * kSampleRate;
constexpr double kToneHz = 196.0;
constexpr int kPartials = 6;
constexpr float kToneAmplitude = 0.3f;
constexpr float kNoiseAmplitude = 0.1f;
constexpr double kUsPerSecond = 1e6;
constexpr auto kPacePoll = std::chrono::microseconds(200);
constexpr auto kPaceTimeout = std::chrono::milliseconds(50);

std::vector<float> NoisyTone(uint64_t frames) {
  std::vector<float> out(frames * kChannels);
  std::minstd_rand engine(1);
  std::uniform_real_distribution<float> noise(
      -kNoiseAmplitude,
      kNoiseAmplitude
  );
  const double step = 2.0 * std::numbers::pi * kToneHz / kSampleRate;
  for (uint64_t i = 0; i < frames; ++i) {
    double tone = 0.0;
    for (int h = 1; h <= kPartials; ++h) {
      tone += std::sin(step * static_cast<double>(i) * h) / h;
    }
    for (uint32_t c = 0; c < kChannels; ++c) {
      out[i * kChannels + c] =
          kToneAmplitude * static_cast<float>(tone) + noise(engine);
    }
  }
  return out;
}

struct Stats {
  double median = 0.0;
  double worst = 0.0;
};

Stats Summarize(std::vector<double> samples) {
  std::sort(samples.begin(), samples.end());
  return {samples[samples.size() / 2], samples.back()};
}

double MicrosSince(Clock::time_point start) {
  return std::chrono::duration<double>(Clock::now() - start).count() *
         kUsPerSecond;
}

void Pace(const kitbag::Mixer& mixer) {
  const uint64_t want = mixer.ring_frames() / 2;
  const auto deadline = Clock::now() + kPaceTimeout;
  for (int t = 0; t < kStems; ++t) {
    while (mixer.track_buffered(t) < want && !mixer.track_at_end(t) &&
           Clock::now() < deadline) {
      std::this_thread::sleep_for(kPacePoll);
    }
  }
}

double TimedBlock(kitbag::Mixer* mixer) {
  static std::vector<float> out(static_cast<size_t>(kBlock) * kChannels);
  Pace(*mixer);
  const auto start = Clock::now();
  mixer->Process(out.data(), kBlock);
  return MicrosSince(start);
}

double WorstOf(kitbag::Mixer* mixer, int blocks) {
  double worst = 0.0;
  for (int b = 0; b < blocks; ++b) worst = std::max(worst, TimedBlock(mixer));
  return worst;
}

struct Rig {
  std::unique_ptr<kitbag::Mixer> mixer;
  int buses = 1;
};

// Keys start at 0 st, so moving stems one by one never passes through more
// keys in use than the target, which would trip the guard mid-play.
int KeyForStem(int stem, int buses) {
  constexpr int kLowest = kitbag::Mixer::kMinPitchSemitones;
  return (stem % buses - kLowest) % kitbag::Mixer::kKeyBusCount + kLowest;
}

void SetKeys(Rig* rig, bool engaged) {
  for (int t = 0; t < kStems; ++t) {
    const int key = engaged ? KeyForStem(t, rig->buses) : 0;
    rig->mixer->SetTrackPitch(t, static_cast<float>(key), 0, false);
  }
  rig->mixer->SetRate(engaged ? kSpeed : kitbag::kUnityRate, 0, false);
}

void BuildRig(Rig* rig, const std::string& path, int buses) {
  rig->buses = buses;
  rig->mixer = std::make_unique<kitbag::Mixer>(kSampleRate);
  for (int t = 0; t < kStems; ++t) {
    rig->mixer->LoadTrack(t, path.c_str(), 0, false);
  }
}

int EngageBlocks(const kitbag::Mixer& mixer) {
  return static_cast<int>(mixer.handover_lead_frames() / kBlock) + kEventBlocks;
}

uint64_t SeekFrame(int repeat) {
  return kSeekStride * static_cast<uint64_t>(repeat + 1);
}

std::vector<double> EngageTimes(Rig* rig) {
  std::vector<double> times;
  for (int r = 0; r < kEventRepeats; ++r) {
    SetKeys(rig, false);
    rig->mixer->Seek(SeekFrame(r), 0, false);
    WorstOf(rig->mixer.get(), kSettleBlocks);
    SetKeys(rig, true);
    times.push_back(WorstOf(rig->mixer.get(), EngageBlocks(*rig->mixer)));
  }
  return times;
}

std::vector<double> SeekTimes(Rig* rig, bool from_stop) {
  std::vector<double> times;
  for (int r = 0; r < kEventRepeats; ++r) {
    WorstOf(rig->mixer.get(), kSettleBlocks);
    if (from_stop) {
      rig->mixer->Stop(0, false);
      rig->mixer->Play();
    } else {
      rig->mixer->Seek(SeekFrame(r), 0, false);
    }
    times.push_back(WorstOf(rig->mixer.get(), kEventBlocks));
  }
  return times;
}

void MixerRow(const std::string& path, int buses) {
  Rig rig;
  BuildRig(&rig, path, buses);
  rig.mixer->Play();
  const Stats engage = Summarize(EngageTimes(&rig));
  std::vector<double> steady;
  int engaged = 0;
  for (int b = 0; b < kSteadyBlocks; ++b) {
    steady.push_back(TimedBlock(rig.mixer.get()));
    engaged += rig.mixer->stretch_engaged() ? 1 : 0;
  }
  const Stats run = Summarize(steady);
  const bool vendor = rig.mixer->key_buses_vendor_default();
  const Stats seek = Summarize(SeekTimes(&rig, false));
  const Stats play = Summarize(SeekTimes(&rig, true));
  std::printf(
      "%5d %-14s %4d/%d %9.0f %9.0f %9.0f %9.0f %9.0f\n",
      buses,
      vendor ? "presetDefault" : "chosen",
      engaged,
      kSteadyBlocks,
      run.median,
      run.worst,
      engage.worst,
      seek.worst,
      play.worst
  );
  rig.mixer->Stop(0, false);
}

using Buses = std::vector<std::unique_ptr<kitbag::KeyBus>>;

Buses MakeBuses(int count, bool vendor, const std::vector<float>& pcm) {
  Buses buses;
  for (int s = 0; s < count; ++s) {
    auto bus = std::make_unique<kitbag::KeyBus>();
    bus->Configure(
        kSampleRate,
        s + kitbag::Mixer::kMinPitchSemitones,
        {.vendor_default = vendor}
    );
    std::copy_n(pcm.begin(), bus->preroll.size(), bus->preroll.begin());
    std::copy_n(pcm.begin(), bus->input.size(), bus->input.begin());
    buses.push_back(std::move(bus));
  }
  return buses;
}

double BusBlock(Buses* buses, bool prime) {
  const auto take = static_cast<int>(kSpeed * kBlock);
  const auto start = Clock::now();
  for (auto& bus : *buses) {
    const int lag =
        std::min(bus->stretch.SongLagFrames(kSpeed), bus->stretch.SeekFrames());
    if (prime) bus->stretch.OutputSeek(bus->preroll.data(), lag);
    bus->stretch.Process(bus->input.data(), take, bus->output.data(), kBlock);
  }
  return MicrosSince(start);
}

void BusRow(const std::vector<float>& pcm, int count, bool vendor) {
  Buses buses = MakeBuses(count, vendor, pcm);
  std::vector<double> steady;
  std::vector<double> primed;
  steady.reserve(kSteadyBlocks);
  primed.reserve(kEventRepeats);
  for (int b = 0; b < kSteadyBlocks; ++b) {
    steady.push_back(BusBlock(&buses, false));
  }
  for (int r = 0; r < kEventRepeats; ++r) {
    primed.push_back(BusBlock(&buses, true));
  }
  const Stats run = Summarize(steady);
  const Stats prime = Summarize(primed);
  std::printf(
      "%5d %-14s %9.0f %9.0f %9.0f %9.0f\n",
      count,
      vendor ? "presetDefault" : "chosen",
      run.median,
      run.worst,
      prime.median,
      prime.worst
  );
}

void PrintMixerHeader() {
  std::printf(
      "prime_bench: host timing in us, %d stereo stems, %u-frame blocks at "
      "%u Hz (budget %.0f us), %.2fx\n",
      kStems,
      kBlock,
      kSampleRate,
      kUsPerSecond * kBlock / kSampleRate,
      static_cast<double>(kSpeed)
  );
  std::printf(
      "mixer, guard picks the config; event columns are worst blocks\n"
  );
  std::printf(
      "%5s %-14s %8s %9s %9s %9s %9s %9s\n",
      "buses",
      "config",
      "engaged",
      "run med",
      "run max",
      "engage",
      "seek",
      "play"
  );
}

void PrintBusHeader() {
  std::printf("key buses alone, config forced; prime = OutputSeek + Process\n");
  std::printf(
      "%5s %-14s %9s %9s %9s %9s\n",
      "buses",
      "config",
      "run med",
      "run max",
      "prime med",
      "prime max"
  );
}

}  // namespace

int main() {
  const std::vector<float> pcm = NoisyTone(kSongFrames);
  PrintMixerHeader();
  const std::string path = media_test::UniqueTempPath("prime_bench");
  if (!media_test::WriteFloatWav(path, pcm, kChannels, kSampleRate)) return 1;
  for (int buses : kBusCounts) MixerRow(path, buses);
  std::filesystem::remove(path);
  PrintBusHeader();
  for (int buses : kBusCounts) {
    for (bool vendor : {false, true}) BusRow(pcm, buses, vendor);
  }
  return 0;
}
