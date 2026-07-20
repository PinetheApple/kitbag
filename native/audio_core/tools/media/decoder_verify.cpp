// Decoder is the offline path behind kb_analyze_song, and had no tool at all —
// which is why it shipped decoding 16-bit files as NaN and 1e38 garbage. Separate
// from file_audio_reader_verify: that tool exists to prove the SourceReader
// seam, and Decoder is not on it.
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "media/decoder.h"
#include "media_test_support.h"
#include "wav_fixture.h"

namespace {

// A run-count guard against a deleted call, not a coverage figure: several
// checks below are subsumed by the exact-value sweep and kept for localisation.
constexpr int kExpectedChecks = 13;
// Prime, so neither the frame count nor its half lands on a round number a
// wrong answer could also produce.
constexpr uint64_t kFixtureFrames = 997;
constexpr double kDurationTolerance = 1e-9;

using kitbag::Decoder;

void TestMetadata(const Decoder& decoder) {
  const kitbag::DecoderInfo info = decoder.info();
  kitbag_test::Check(
      info.channels == media_test::kFixtureChannels,
      "decoder: channel count"
  );
  kitbag_test::Check(
      info.sample_rate == media_test::kFixtureRate,
      "decoder: sample rate"
  );
  kitbag_test::Check(info.total_frames == kFixtureFrames, "decoder: frames");
  const double expected_seconds =
      static_cast<double>(kFixtureFrames) / media_test::kFixtureRate;
  kitbag_test::Check(
      std::fabs(info.duration_seconds - expected_seconds) < kDurationTolerance,
      "decoder: duration"
  );
}

// The range check is implied by the exact one (ExpectedFloat is bounded by the
// fixture's sub-full-scale modulus) and kept to localise: NaN and 1e38 here.
void TestSampleValues(const std::vector<float>& pcm) {
  bool exact = true;
  bool in_range = true;
  for (uint64_t i = 0; i < pcm.size(); ++i) {
    if (pcm[i] != media_test::ExpectedFloat(i)) exact = false;
    if (!(pcm[i] >= -1.0F && pcm[i] <= 1.0F)) in_range = false;
  }
  kitbag_test::Check(exact, "decoder: s16 converts to the exact float value");
  kitbag_test::Check(in_range, "decoder: every sample lies in [-1, 1]");
}

// Subsumed by the exact-value sweep above and kept only to localise a failure:
// "the back half is written" names the s16 under-fill, "not exact" does not.
void TestTailIsWritten(const std::vector<float>& pcm) {
  const uint64_t last = pcm.size() - 1;
  const uint64_t midpoint = pcm.size() / 2;
  kitbag_test::Check(
      pcm[last] == media_test::ExpectedFloat(last),
      "decoder: the last sample is written"
  );
  kitbag_test::Check(
      pcm[midpoint] == media_test::ExpectedFloat(midpoint),
      "decoder: the back half is written"
  );
}

void TestDecodeAll(Decoder* decoder) {
  uint64_t frames = 0;
  const std::vector<float> pcm = decoder->DecodeAll(&frames);
  kitbag_test::Check(frames == kFixtureFrames, "decoder: decodes every frame");
  kitbag_test::Check(
      pcm.size() == kFixtureFrames * media_test::kFixtureChannels,
      "decoder: buffer holds frames * channels samples"
  );
  if (pcm.size() != kFixtureFrames * media_test::kFixtureChannels) return;
  TestSampleValues(pcm);
  TestTailIsWritten(pcm);
}

void TestUnopened() {
  Decoder decoder;
  kitbag_test::Check(
      !decoder.Open("/nonexistent/kitbag.wav"),
      "decoder: open fails on a missing file"
  );
  uint64_t frames = 1;
  kitbag_test::Check(
      decoder.DecodeAll(&frames).empty() && frames == 0,
      "decoder: an unopened decoder yields nothing"
  );
}

bool RunAll(const std::filesystem::path& path) {
  if (!media_test::WriteWav(path.string(), kFixtureFrames)) {
    std::fprintf(stderr, "decoder_verify: cannot write the fixture\n");
    return false;
  }
  Decoder decoder;
  kitbag_test::Check(
      decoder.Open(path.string().c_str()),
      "decoder: opens the wav"
  );
  TestMetadata(decoder);
  TestDecodeAll(&decoder);
  decoder.Close();
  TestUnopened();
  std::filesystem::remove(path);
  return true;
}

}  // namespace

int main() {
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "kitbag_decoder_s16.wav";
  if (!RunAll(path)) return 1;

  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "decoder_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("decoder_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "decoder_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
