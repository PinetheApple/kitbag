// A2 (SPEC.md §4.1, design-audit F4): a track whose rate differs from the
// engine rate is resampled on load, not silently dropped. A 44.1kHz stem must
// play at a 48k engine rate — the right length and the right pitch.
#include <cmath>
#include <vector>

#include "media/audio_source.h"
#include "media/resampling_source_reader.h"
#include "mixer_test_support.h"

namespace mixer_test {
namespace {

constexpr uint32_t kInRate = 44100;
constexpr uint64_t kInFrames = 44100;  // one second at 44.1kHz
constexpr uint64_t kExpectedOut = 48000;
constexpr double kToneHz = 1000.0;
// The pitch a 1000Hz-at-44.1k tone plays at if it is fed to a 48k engine
// without resampling: 1000 * 48000/44100. The wrong answer to discriminate from.
constexpr double kUnresampledHz = kToneHz * kExpectedOut / kInRate;
constexpr double kTwoPi = 6.283185307179586;
constexpr float kAmplitude = 0.5f;

// A mono sine at kInRate, so its sample_rate() forces the mixer to resample.
class SineReader : public kitbag::SourceReader {
 public:
  uint32_t channels() const override {
    return 1;
  }
  uint32_t sample_rate() const override {
    return kInRate;
  }
  uint64_t total_frames() const override {
    return kInFrames;
  }

  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    const uint64_t avail = pos_ < kInFrames ? kInFrames - pos_ : 0;
    const uint64_t n = frames < avail ? frames : avail;
    for (uint64_t i = 0; i < n; ++i) {
      const double t = static_cast<double>(pos_ + i) / kInRate;
      dst[i] = kAmplitude * static_cast<float>(std::sin(kTwoPi * kToneHz * t));
    }
    pos_ += n;
    return {
        n,
        n == frames ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > kInFrames) return false;
    pos_ = frame;
    return true;
  }

 private:
  uint64_t pos_ = 0;
};

// Goertzel energy at [freq] over [sig] sampled at the engine rate. A correct
// resample keeps the tone at kToneHz; a skipped one shifts it to kUnresampledHz.
double ToneEnergy(const std::vector<float>& sig, double freq) {
  const double w = kTwoPi * freq / kSampleRate;
  const double coeff = 2.0 * std::cos(w);
  double s1 = 0.0;
  double s2 = 0.0;
  for (float x : sig) {
    const double s = static_cast<double>(x) + coeff * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

float Peak(const std::vector<float>& sig) {
  float peak = 0.0f;
  for (float s : sig) peak = std::fabs(s) > peak ? std::fabs(s) : peak;
  return peak;
}

// Pitch measured on the steady middle, away from filter transient and tail: a
// correct resample concentrates energy at kToneHz, a skipped one at the shifted
// pitch. Discriminates by a wide margin either way.
void CheckPitchIsPreserved(const std::vector<float>& sig, const char* label) {
  const std::vector<float> mid(sig.begin() + 200, sig.begin() + 47000);
  const double at_tone = ToneEnergy(mid, kToneHz);
  const double at_wrong = ToneEnergy(mid, kUnresampledHz);
  Check(at_tone > at_wrong * 8.0, label);
}

// Read the whole resampled stream synchronously — no read-ahead thread — so the
// frame count and pitch are deterministic rather than racing a refiller.
void TestResamplerFrameCountAndPitch() {
  SineReader reader;
  kitbag::ResamplingSourceReader rs(&reader, kSampleRate);
  Check(rs.ok(), "resampler: converter initialises for 44.1k -> 48k");
  Check(
      rs.total_frames() >= kExpectedOut - 2 &&
          rs.total_frames() <= kExpectedOut,
      "resampler: reported length is the 48k frame count, not the 44.1k input"
  );

  std::vector<float> out;
  out.reserve(kExpectedOut + kBlock);
  std::vector<float> buf(kBlock);
  while (true) {
    const kitbag::ReadResult r = rs.ReadFrames(buf.data(), kBlock);
    for (uint64_t i = 0; i < r.frames; ++i) out.push_back(buf[i]);
    if (r.status == kitbag::ReadStatus::kEndOfStream) break;
  }
  Check(
      out.size() >= kExpectedOut - 2 && out.size() <= kExpectedOut,
      "resampler: delivers ~48000 frames for a 44100-frame second"
  );
  Check(Peak(out) > 0.4f, "resampler: output is audible, not silent");
  CheckPitchIsPreserved(
      out,
      "resampler: the tone stays at 1000Hz, not the 1088Hz of a skipped "
      "resample"
  );
}

// Renders [blocks] blocks and returns the left channel. Bounded so a headless
// tight loop stays within what Play() has primed and does not outrun the
// asynchronous read-ahead thread.
std::vector<float> RenderLeft(kitbag::Mixer* mixer, int blocks) {
  std::vector<float> left;
  for (int b = 0; b < blocks; ++b) {
    const std::vector<float> block = RenderBlock(mixer);
    for (uint32_t f = 0; f < kBlock; ++f) left.push_back(block[f * 2]);
  }
  return left;
}

// The end-to-end mixer path: loading a 44.1k source resamples it rather than
// dropping it, and the transport length is the resampled one.
void TestMixerResamplesOnLoad() {
  SineReader reader;
  kitbag::Mixer mixer(kSampleRate);
  Check(
      mixer.SetTrackSource(0, &reader),
      "resample: a 44.1kHz stem loads rather than being rejected"
  );
  const uint64_t frames = mixer.track_frames(0);
  Check(
      frames >= kExpectedOut - 2 && frames <= kExpectedOut,
      "resample: track length is the 48k frame count, not the 44.1k input"
  );

  mixer.Play();
  // 4096 frames is the prime-ahead floor, so eight blocks are ready at once.
  const std::vector<float> left = RenderLeft(&mixer, 8);
  Check(Peak(left) > 0.4f, "resample: the mixed 44.1k stem is audible");
  const double at_tone = ToneEnergy(left, kToneHz);
  const double at_wrong = ToneEnergy(left, kUnresampledHz);
  Check(
      at_tone > at_wrong * 8.0,
      "resample: the mixed stem plays at 1000Hz, not a skipped-resample pitch"
  );
  mixer.Stop();
}

}  // namespace

void RunResampleTests() {
  TestResamplerFrameCountAndPitch();
  TestMixerResamplesOnLoad();
}

}  // namespace mixer_test
