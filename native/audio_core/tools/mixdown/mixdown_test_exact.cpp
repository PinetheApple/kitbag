// The live render through kb_engine_render is the oracle: the file must be
// what the device would have played, sample for sample in s16.
#include <algorithm>
#include <cstdio>
#include <string>

#include "mixdown_test_support.h"

namespace mixdown_test {
namespace {

// Uneven lengths, none a multiple of a block, and a 44.1 kHz stereo stem, so
// the tail, the zero-padding and the resampler are all in the comparison.
constexpr uint64_t kFramesA = 70001;
constexpr uint64_t kFramesB = 50000;
constexpr uint64_t kFramesC = 61237;
constexpr uint32_t kSeedA = 11;
constexpr uint32_t kSeedB = 29;
constexpr double kToneHz = 523.0;
constexpr float kToneAmplitude = 0.3f;
// Track 2 is left empty: the snapshot must skip a gap without reordering.
constexpr int kTrackA = 0;
constexpr int kTrackB = 1;
constexpr int kTrackC = 3;
constexpr float kGainA = 0.6f;
constexpr float kGainB = 1.3f;
constexpr float kGainC = 0.9f;
constexpr float kMasterGain = 0.8f;
constexpr uint32_t kWavHeaderTail = 36;
constexpr uint16_t kPcmFormat = 1;
constexpr uint16_t kBitsPerSample = 16;
constexpr uint64_t kBlocksBeforeMixdown = 40;

struct Stems {
  std::string a;
  std::string b;
  std::string c;
};

const Stems& Fixture() {
  static const Stems kStems{
      WriteStem("a", Noise(kFramesA, kMono, kSeedA), kMono, kSampleRate),
      WriteStem("b", Noise(kFramesB, kStereo, kSeedB), kStereo, kStemRate44k),
      WriteStem(
          "c",
          Sine(kFramesC, kToneHz, kToneAmplitude),
          kMono,
          kSampleRate
      )
  };
  return kStems;
}

kb_engine* LoadedEngine() {
  kb_engine* engine = OpenEngine();
  if (engine == nullptr) return nullptr;
  const Stems& stems = Fixture();
  kb_mixer_load_track(engine, kTrackA, stems.a.c_str());
  kb_mixer_load_track(engine, kTrackB, stems.b.c_str());
  kb_mixer_load_track(engine, kTrackC, stems.c.c_str());
  kb_mixer_set_gain(engine, kTrackA, kGainA);
  kb_mixer_set_gain(engine, kTrackB, kGainB);
  kb_mixer_set_gain(engine, kTrackC, kGainC);
  kb_mixer_set_master_gain(engine, kMasterGain);
  return engine;
}

uint64_t LongestFrames(kb_engine* engine) {
  int64_t longest = 0;
  for (int32_t t = 0; t < kb_mixer_active_track_count(engine); ++t) {
    longest = std::max(longest, kb_mixer_track_frames(engine, t));
  }
  return static_cast<uint64_t>(longest);
}

void CheckHeader(const WavFile& wav, uint64_t frames, const std::string& tag) {
  const auto data = static_cast<uint32_t>(frames * kStereo * sizeof(int16_t));
  Check(wav.parsed && wav.format == kPcmFormat, (tag + ": PCM WAV").c_str());
  Check(wav.channels == kStereo, (tag + ": stereo").c_str());
  Check(wav.sample_rate == kSampleRate, (tag + ": engine rate").c_str());
  Check(wav.bits == kBitsPerSample, (tag + ": 16-bit").c_str());
  Check(wav.data_bytes == data, (tag + ": data size patched").c_str());
  Check(
      wav.riff_bytes == data + kWavHeaderTail,
      (tag + ": RIFF size patched").c_str()
  );
}

void CheckSameAsLive(
    const WavFile& wav,
    const std::vector<int16_t>& live,
    const std::string& tag
) {
  const uint64_t differ = Mismatches(wav.samples, live);
  Check(differ == 0, (tag + ": file equals the live render in s16").c_str());
  if (differ != 0) {
    std::fprintf(stderr, "  %llu samples differ\n", (unsigned long long)differ);
  }
  Check(
      PeakOf(wav.samples) > kAudiblePeak,
      (tag + ": file not silent").c_str()
  );
}

WavFile Mixdown(kb_engine* engine, const std::string& tag) {
  const std::string path = TempPath(tag, ".wav");
  Check(
      kb_mixdown_start(engine, path.c_str()) == KB_OK,
      (tag + ": start").c_str()
  );
  Check(WaitForMixdown(engine), (tag + ": finishes").c_str());
  Check(
      kb_mixdown_current_state(engine) == KB_MIXDOWN_STATE_DONE,
      (tag + ": DONE").c_str()
  );
  Check(kb_mixdown_progress(engine) == 1.0, (tag + ": progress 1").c_str());
  Check(
      !Exists(path + kitbag::WavWriter::kPartSuffix),
      (tag + ": no .part left").c_str()
  );
  return ReadWav(path);
}

void CheckMatchesLive(kb_engine* engine, const std::string& tag) {
  const uint64_t frames = LongestFrames(engine);
  const WavFile wav = Mixdown(engine, tag);
  Check(kb_mixer_position(engine) == 0, (tag + ": live head unmoved").c_str());
  Check(kb_mixer_is_playing(engine) == 0, (tag + ": live not started").c_str());
  Check(wav.frames() == frames, (tag + ": whole song, no tail").c_str());
  CheckHeader(wav, frames, tag);
  kb_mixer_play(engine);
  CheckSameAsLive(wav, RenderLive(engine, frames), tag);
}

void TestGainsAndMaster() {
  kb_engine* engine = LoadedEngine();
  if (engine == nullptr) return;
  CheckMatchesLive(engine, "gains");
  kb_engine_destroy(engine);
}

void TestMute() {
  kb_engine* engine = LoadedEngine();
  if (engine == nullptr) return;
  kb_mixer_set_mute(engine, kTrackB, 1);
  CheckMatchesLive(engine, "mute");
  kb_engine_destroy(engine);
}

void TestSolo() {
  kb_engine* engine = LoadedEngine();
  if (engine == nullptr) return;
  kb_mixer_set_solo(engine, kTrackC, 1);
  CheckMatchesLive(engine, "solo");
  kb_engine_destroy(engine);
}

void TestDuringPlayback() {
  kb_engine* engine = LoadedEngine();
  if (engine == nullptr) return;
  const uint64_t frames = LongestFrames(engine);
  kb_mixer_play(engine);
  std::vector<int16_t> live =
      RenderLive(engine, kBlocksBeforeMixdown * kLiveBlock);
  const std::string path = TempPath("live", ".wav");
  Check(kb_mixdown_start(engine, path.c_str()) == KB_OK, "live: start");
  const std::vector<int16_t> rest =
      RenderLive(engine, frames - live.size() / 2);
  live.insert(live.end(), rest.begin(), rest.end());
  Check(WaitForMixdown(engine), "live: finishes");
  Check(
      kb_mixdown_current_state(engine) == KB_MIXDOWN_STATE_DONE,
      "live: DONE"
  );
  CheckSameAsLive(ReadWav(path), live, "live");
  kb_engine_destroy(engine);
}

void TestRefusals() {
  kb_engine* engine = OpenEngine();
  if (engine == nullptr) return;
  const std::string path = TempPath("refused", ".wav");
  Check(
      kb_mixdown_start(engine, path.c_str()) == KB_ERROR_INVALID_ARGUMENT,
      "refused: no stem loaded"
  );
  Check(
      kb_mixdown_start(engine, nullptr) == KB_ERROR_INVALID_ARGUMENT,
      "refused: null path"
  );
  kb_engine_destroy(engine);
}

void TestMissingStemFails() {
  kb_engine* engine = OpenEngine();
  if (engine == nullptr) return;
  const std::string path = TempPath("missing", ".wav");
  const std::string gone =
      WriteStem("gone", Noise(kFramesA, kMono, kSeedA), kMono, kSampleRate);
  kb_mixer_load_track(engine, kTrackA, gone.c_str());
  std::remove(gone.c_str());
  Check(
      kb_mixdown_start(engine, path.c_str()) == KB_OK,
      "missing stem: starts, the load runs on the worker"
  );
  Check(WaitForMixdown(engine), "missing stem: stops");
  Check(
      kb_mixdown_current_state(engine) == KB_MIXDOWN_STATE_FAILED,
      "missing stem: FAILED"
  );
  Check(!Exists(path), "missing stem: no file");
  Check(
      !Exists(path + kitbag::WavWriter::kPartSuffix),
      "missing stem: no .part"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunExactTests() {
  TestGainsAndMaster();
  TestMute();
  TestSolo();
  TestDuringPlayback();
  TestRefusals();
  TestMissingStemFails();
}

}  // namespace mixdown_test
