#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "click_sound_test_support.h"
#include "media/audio_source.h"
#include "media/part_file.h"
#include "metronome/click_sound_prepare.h"
#include "metronome/custom_sound_limits.h"

namespace click_sound_test {

using kitbag_test::Check;

namespace {

constexpr uint32_t kRate = kitbag::kCustomSoundRate;
constexpr float kFadePeak = 0.37F;
constexpr uint64_t kStatedFrames = 48000;
constexpr uint64_t kDeliveredFrames = 30011;

class ShortReader : public kitbag::SourceReader {
 public:
  ShortReader(std::vector<float> samples, uint64_t stated)
      : samples_(std::move(samples)), stated_(stated) {}

  uint32_t channels() const override {
    return 1;
  }
  uint32_t sample_rate() const override {
    return kRate;
  }
  uint64_t total_frames() const override {
    return stated_;
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    const uint64_t n = std::min<uint64_t>(frames, samples_.size() - cursor_);
    std::copy_n(samples_.begin() + static_cast<long>(cursor_), n, dst);
    cursor_ += n;
    return {
        n,
        n < frames ? kitbag::ReadStatus::kEndOfStream : kitbag::ReadStatus::kOk
    };
  }
  bool SeekToFrame(uint64_t) override {
    return false;
  }

 private:
  std::vector<float> samples_;
  uint64_t stated_;
  uint64_t cursor_ = 0;
};

float FadeError(
    const std::vector<float>& got,
    const std::vector<float>& body,
    float gain
) {
  if (got.size() != body.size() || got.size() < kFadeFrames) return INFINITY;
  const size_t start = got.size() - kFadeFrames;
  float worst = 0.0F;
  for (size_t i = 0; i < kFadeFrames; ++i) {
    const float ramp = static_cast<float>(kFadeFrames - 1 - i) /
                       static_cast<float>(kFadeFrames);
    worst = std::max(
        worst,
        std::fabs(got[start + i] - body[start + i] * gain * ramp)
    );
  }
  return worst;
}

void TestFadeEndsAtSilence() {
  const std::vector<float> body = Body(kRate / 2, kFadePeak);
  const std::string in = Fixture("cs_fade", body, 1, kRate);
  const std::string out = OutPath("cs_fade_out");
  Check(
      kitbag::PrepareClickSound(in.c_str(), out.c_str()) == KB_OK,
      "fade: fixture prepared"
  );
  uint32_t rate = 0;
  uint32_t channels = 0;
  const std::vector<float> got = ReadMono(out, &rate, &channels);
  const size_t start = got.size() - kFadeFrames;
  const float gain = kitbag::kClickSoundPeak / kFadePeak;
  Check(
      got.size() == body.size() && got.back() == 0.0F,
      "fade: the sound ends on silence"
  );
  Check(
      std::fabs(got[start - 1] - body[start - 1] * gain) < kSampleTolerance,
      "fade: nothing before the last 5 ms is faded"
  );
  Check(
      FadeError(got, body, gain) < kSampleTolerance,
      "fade: the last 5 ms ramp linearly to zero"
  );
  std::remove(in.c_str());
  std::remove(out.c_str());
}

void TestShortReadIsAnError() {
  const std::vector<float> body = Body(kStatedFrames, 0.5F);
  const std::string out = OutPath("cs_short_out");
  ShortReader whole(body, kStatedFrames);
  Check(
      kitbag::PrepareClickSoundFrom(&whole, out.c_str()) == KB_OK,
      "decode error: a source that delivers its stated length is accepted"
  );
  std::remove(out.c_str());
  ShortReader cut(
      std::vector<float>(body.begin(), body.begin() + kDeliveredFrames),
      kStatedFrames
  );
  Check(
      kitbag::PrepareClickSoundFrom(&cut, out.c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "decode error: a source that stops short of its stated length is refused"
  );
  Check(!std::filesystem::exists(out), "decode error: nothing is written");
}

std::string PreparedOutput(const std::string& name) {
  const std::string in = Fixture(name, Body(kRate / 3, 0.5F), 1, kRate);
  const std::string out = OutPath(name + "_out");
  kitbag::PrepareClickSound(in.c_str(), out.c_str());
  std::remove(in.c_str());
  return out;
}

kb_result PrepareOnto(const std::string& out, const std::vector<float>& pcm) {
  const std::string in = Fixture("cs_onto", pcm, 1, kRate);
  const kb_result result = kitbag::PrepareClickSound(in.c_str(), out.c_str());
  std::remove(in.c_str());
  return result;
}

void TestRefusalsKeepExistingBytes() {
  const std::string out = PreparedOutput("cs_keep");
  const std::vector<uint8_t> before = FileBytes(out);
  const size_t too_long =
      static_cast<size_t>(kitbag::kMaxCustomSoundSeconds) * kRate + 1;
  Check(
      PrepareOnto(out, std::vector<float>(kRate, 0.0F)) == KB_ERROR_SILENT,
      "replace: a silent replacement is refused"
  );
  Check(
      PrepareOnto(out, Body(too_long, 0.5F)) == KB_ERROR_TOO_LONG,
      "replace: a long replacement is refused"
  );
  ShortReader cut(Body(kDeliveredFrames, 0.5F), kStatedFrames);
  Check(
      kitbag::PrepareClickSoundFrom(&cut, out.c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "replace: a replacement that fails to decode is refused"
  );
  Check(
      !before.empty() && FileBytes(out) == before,
      "replace: refused replacements leave the slot's file byte-identical"
  );
  std::remove(out.c_str());
}

void TestDiskFullIsNoSpace() {
  const std::string out = PreparedOutput("cs_full");
  const std::vector<uint8_t> before = FileBytes(out);
  const std::string part = out + kitbag::kPartSuffix;
  std::error_code error;
  std::filesystem::create_symlink("/dev/full", part, error);
  Check(!error, "disk full: .part points at /dev/full");
  Check(
      PrepareOnto(out, Body(kRate / 2, 0.5F)) == KB_ERROR_NO_SPACE,
      "disk full: a write that fills the volume returns KB_ERROR_NO_SPACE"
  );
  Check(
      FileBytes(out) == before,
      "disk full: the slot's file is byte-identical"
  );
  Check(!std::filesystem::is_symlink(part), "disk full: the .part is removed");
  std::filesystem::remove(part, error);
  std::remove(out.c_str());
}

}  // namespace

void RunWriteTests() {
  TestFadeEndsAtSilence();
  TestShortReadIsAnError();
  TestRefusalsKeepExistingBytes();
  TestDiskFullIsNoSpace();
}

}  // namespace click_sound_test
