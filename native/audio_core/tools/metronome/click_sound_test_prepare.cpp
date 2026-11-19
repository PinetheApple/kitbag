#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

#include "click_sound_test_support.h"
#include "media/file_audio_reader.h"
#include "metronome/click_sound_prepare.h"
#include "metronome/custom_sound_limits.h"

namespace click_sound_test {

using kitbag_test::Check;

namespace {

constexpr uint32_t kRate = kitbag::kCustomSoundRate;
constexpr size_t kLeadFrames = 12347;
constexpr size_t kBodyFrames = 20011;
constexpr float kQuietPeak = 0.37F;
constexpr size_t kFormatTagOffset = 20;
constexpr size_t kBitsOffset = 34;
constexpr uint8_t kFloatTag = 3;
constexpr uint8_t kFloatBits = 32;
constexpr int kResampleToleranceFrames = 4;

std::vector<float>
ReadMono(const std::string& path, uint32_t* rate, uint32_t* channels) {
  kitbag::FileAudioReader reader;
  if (!reader.Open(path.c_str())) return {};
  *rate = reader.sample_rate();
  *channels = reader.channels();
  std::vector<float> pcm(reader.total_frames() * reader.channels());
  reader.ReadFrames(pcm.data(), reader.total_frames());
  return pcm;
}

std::vector<uint8_t> FileBytes(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  return {std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>()};
}

float MaxError(
    const std::vector<float>& got,
    const std::vector<float>& want,
    float scale
) {
  if (got.size() != want.size()) return INFINITY;
  float worst = 0.0F;
  for (size_t i = 0; i < got.size(); ++i) {
    worst = std::max(worst, std::fabs(got[i] - want[i] * scale));
  }
  return worst;
}

float Peak(const std::vector<float>& pcm) {
  float peak = 0.0F;
  for (float s : pcm) peak = std::max(peak, std::fabs(s));
  return peak;
}

struct Prepared {
  kb_result result = KB_ERROR_INTERNAL;
  std::vector<float> mono;
  uint32_t rate = 0;
  uint32_t channels = 0;
  std::vector<uint8_t> bytes;
  bool part_left = false;
};

Prepared PrepareAndRead(
    const std::string& name,
    const std::vector<float>& pcm,
    uint32_t channels,
    uint32_t rate
) {
  const std::string in = Fixture(name, pcm, channels, rate);
  const std::string out = OutPath(name + "_out");
  Prepared prepared;
  prepared.result = kitbag::PrepareClickSound(in.c_str(), out.c_str());
  prepared.mono = ReadMono(out, &prepared.rate, &prepared.channels);
  prepared.bytes = FileBytes(out);
  prepared.part_left = std::filesystem::exists(out + ".part");
  std::remove(in.c_str());
  std::remove(out.c_str());
  return prepared;
}

void TestTrimsToFirstAudibleSample() {
  const std::vector<float> body = Body(kBodyFrames, kQuietPeak);
  const Prepared got = PrepareAndRead(
      "cs_trim",
      Concat(SubThresholdLead(kLeadFrames), body),
      1,
      kRate
  );
  Check(got.result == KB_OK, "prepare: a quiet mono 48 kHz sound is accepted");
  Check(
      got.mono.size() == kBodyFrames,
      "prepare: everything before the first sample at -60 dBFS is trimmed, "
      "nothing after"
  );
  Check(
      !got.mono.empty() &&
          std::fabs(got.mono[0] - kJustAudible / kQuietPeak) < kSampleTolerance,
      "prepare: the first kept sample is the first audible one"
  );
  Check(
      MaxError(got.mono, body, 1.0F / kQuietPeak) < kSampleTolerance,
      "prepare: every kept sample is the input scaled by one gain"
  );
  Check(
      std::fabs(Peak(got.mono) - kitbag::kClickSoundPeak) < kSampleTolerance,
      "prepare: a quiet sound is raised to the built-ins' peak"
  );
}

void TestWritesMonoFloatWav() {
  const Prepared got =
      PrepareAndRead("cs_format", Body(kBodyFrames, kQuietPeak), 1, kRate);
  Check(
      got.rate == kRate && got.channels == 1,
      "prepare: output is mono at 48 kHz"
  );
  Check(
      got.bytes.size() > kBitsOffset &&
          got.bytes[kFormatTagOffset] == kFloatTag &&
          got.bytes[kBitsOffset] == kFloatBits,
      "prepare: output is a 32-bit float WAV"
  );
  Check(!got.part_left, "prepare: no .part left after success");
}

void TestLoudSoundIsLowered() {
  const std::vector<float> body = Body(kBodyFrames, 1.7F);
  const Prepared got = PrepareAndRead("cs_loud", body, 1, kRate);
  Check(got.result == KB_OK, "prepare: a sound over full scale is accepted");
  Check(
      MaxError(got.mono, body, 1.0F / 1.7F) < kSampleTolerance,
      "prepare: a sound over full scale is scaled down, not clipped"
  );
}

void TestDownmixAveragesChannels() {
  const std::vector<float> left = Body(kBodyFrames, 0.8F);
  std::vector<float> stereo;
  std::vector<float> mono;
  for (size_t i = 0; i < kBodyFrames; ++i) {
    const auto t = static_cast<double>(i);
    const auto right = static_cast<float>(0.21 * std::cos(0.031 * t));
    stereo.push_back(left[i]);
    stereo.push_back(right);
    mono.push_back((left[i] + right) / 2.0F);
  }
  const Prepared got = PrepareAndRead("cs_stereo", stereo, 2, kRate);
  Check(got.result == KB_OK, "downmix: a stereo sound is accepted");
  Check(got.channels == 1, "downmix: stereo becomes one channel");
  Check(
      MaxError(got.mono, mono, 1.0F / Peak(mono)) < kSampleTolerance,
      "downmix: each frame is the mean of its channels"
  );
}

std::vector<float> DualMono(const std::vector<float>& mono) {
  std::vector<float> stereo;
  for (float s : mono) {
    stereo.push_back(s);
    stereo.push_back(s);
  }
  return stereo;
}

void TestResamplesTo48k() {
  constexpr uint32_t kCdRate = 44100;
  constexpr size_t kCdLead = 4410;
  constexpr size_t kCdBody = 22050;
  const std::vector<float> pcm =
      Concat(std::vector<float>(kCdLead, 0.0F), Body(kCdBody, 0.5F));
  const Prepared got = PrepareAndRead("cs_cd", DualMono(pcm), 2, kCdRate);
  const auto expected = static_cast<long>(kCdBody * kRate / kCdRate);
  std::printf(
      "  resample: %zu frames from %zu at 44.1 kHz (exact ratio %ld)\n",
      got.mono.size(),
      kCdBody,
      expected
  );
  Check(
      got.result == KB_OK && got.rate == kRate,
      "resample: a 44.1 kHz sound comes out at 48 kHz"
  );
  Check(
      std::labs(static_cast<long>(got.mono.size()) - expected) <=
          kResampleToleranceFrames,
      "resample: the trimmed length scales by 48000/44100"
  );
}

}  // namespace

void RunPrepareTests() {
  TestTrimsToFirstAudibleSample();
  TestWritesMonoFloatWav();
  TestLoudSoundIsLowered();
  TestDownmixAveragesChannels();
  TestResamplesTo48k();
}

}  // namespace click_sound_test
