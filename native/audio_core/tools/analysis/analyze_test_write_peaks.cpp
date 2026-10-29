#include "kitbag_api.h"

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <limits>
#include <string>
#include <vector>

#include "analyze_test_support.h"
#include "check.h"

namespace analyze_test {

namespace {

constexpr int32_t kStereo = 2;
constexpr int32_t kChunks = 2;
constexpr int64_t kFrames = 1000;
constexpr size_t kPeakValues = static_cast<size_t>(kStereo) * kChunks * 2;

kb_result Write(const std::string& path, int64_t frames, int32_t chunks) {
  const std::vector<float> peaks(kPeakValues, 0.0f);
  return kb_waveform_write_peaks(path.c_str(), 1, frames, peaks.data(), chunks);
}

// Expected codes are 32767 * value truncated, worked by hand, not read back.
void TestQuantisedRoundTrip(const std::filesystem::path& dir) {
  const float nan = std::numeric_limits<float>::quiet_NaN();
  const std::vector<float> input =
      {-0.5f, 0.5f, -1.0f, 1.0f, -3.0f, 2.0f, nan, 0.25f};
  const std::vector<int16_t> expected =
      {-16383, 16383, -32767, 32767, -32767, 32767, 0, 8191};
  const std::string path = (dir / "write_peaks.kwav").string();
  kitbag_test::Check(
      kb_waveform_write_peaks(
          path.c_str(),
          kStereo,
          kFrames,
          input.data(),
          kChunks
      ) == KB_OK,
      "write peaks: returns KB_OK"
  );
  Sidecar sc;
  kitbag_test::Check(ReadSidecar(path, &sc), "write peaks: file reads back");
  kitbag_test::Check(
      std::string(sc.magic, 4) == "KWAV" && sc.version == 1 &&
          sc.channels == kStereo && sc.total_frames == kFrames &&
          sc.chunk_count == kChunks,
      "write peaks: header matches the analysis sidecar's layout"
  );
  kitbag_test::Check(
      sc.data == expected,
      "write peaks: values quantise and clamp like the analysis writer"
  );
  std::filesystem::remove(path);
}

void TestRefusals(const std::filesystem::path& dir) {
  const std::vector<float> peaks(kPeakValues, 0.0f);
  const std::string path = (dir / "write_peaks_refused.kwav").string();
  kitbag_test::Check(
      kb_waveform_write_peaks(nullptr, 1, kFrames, peaks.data(), 1) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_waveform_write_peaks(path.c_str(), 1, kFrames, nullptr, 1) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_waveform_write_peaks(path.c_str(), 0, kFrames, peaks.data(), 1) ==
              KB_ERROR_INVALID_ARGUMENT &&
          Write(path, kFrames, 0) == KB_ERROR_INVALID_ARGUMENT,
      "write peaks: null or non-positive arguments refused"
  );
  kitbag_test::Check(
      Write(path, 1, kChunks) == KB_ERROR_INVALID_ARGUMENT,
      "write peaks: more chunks than frames refused"
  );
  kitbag_test::Check(
      !std::filesystem::exists(path),
      "write peaks: a refused call leaves no file"
  );
  kitbag_test::Check(
      Write((dir / "no-such-dir" / "x.kwav").string(), kFrames, 1) ==
          KB_ERROR_INTERNAL,
      "write peaks: an unopenable path is KB_ERROR_INTERNAL"
  );
}

constexpr float kEnvelopeTolerance = 1e-4f;

bool Near(const std::vector<float>& got, const std::vector<float>& want) {
  if (got.size() != want.size()) return false;
  for (size_t i = 0; i < got.size(); ++i) {
    if (std::fabs(got[i] - want[i]) > kEnvelopeTolerance) return false;
  }
  return true;
}

constexpr int32_t kMonoChunks = 4;
constexpr float kInt16FullScale = 32767.0f;

// Mono chunks whose loudest |peak| is 0.25, 0.5, 0.75 and 0; codes as above.
std::string WriteEnvelopeFixture(const std::filesystem::path& dir) {
  const std::vector<float> input =
      {-0.25f, 0.1f, 0.0f, 0.5f, -0.75f, 0.0f, 0.0f, 0.0f};
  const std::string path = (dir / "envelope.kwav").string();
  kb_waveform_write_peaks(path.c_str(), 1, kFrames, input.data(), kMonoChunks);
  return path;
}

std::vector<float> Envelope(const std::string& path, int32_t buckets) {
  std::vector<float> out(static_cast<size_t>(buckets));
  if (kb_waveform_read_envelope(path.c_str(), out.data(), buckets) != KB_OK) {
    return {};
  }
  return out;
}

void TestEnvelopeReads(const std::filesystem::path& dir) {
  const std::string path = WriteEnvelopeFixture(dir);
  const float quarter = 8191.0f / kInt16FullScale;
  const float half = 16383.0f / kInt16FullScale;
  const float three_quarters = 24575.0f / kInt16FullScale;
  kitbag_test::Check(
      Near(Envelope(path, 2), {half, three_quarters}),
      "read envelope: each bucket is the loudest chunk it spans"
  );
  kitbag_test::Check(
      Near(Envelope(path, kMonoChunks), {quarter, half, three_quarters, 0.0f}),
      "read envelope: one bucket per chunk reads each chunk"
  );
  kitbag_test::Check(
      Near(
          Envelope(path, 2 * kMonoChunks),
          {quarter,
           quarter,
           half,
           half,
           three_quarters,
           three_quarters,
           0.0f,
           0.0f}
      ),
      "read envelope: more buckets than chunks repeats chunks"
  );
  std::filesystem::remove(path);
}

void TestEnvelopeRefusals(const std::filesystem::path& dir) {
  const std::string path = WriteEnvelopeFixture(dir);
  std::vector<float> out(kMonoChunks);
  std::filesystem::resize_file(path, std::filesystem::file_size(path) - 1);
  kitbag_test::Check(
      kb_waveform_read_envelope(path.c_str(), out.data(), kMonoChunks) ==
          KB_ERROR_INVALID_ARGUMENT,
      "read envelope: a truncated sidecar is refused"
  );
  std::ofstream(path, std::ios::trunc) << "not a sidecar at all";
  kitbag_test::Check(
      kb_waveform_read_envelope(path.c_str(), out.data(), kMonoChunks) ==
              KB_ERROR_INVALID_ARGUMENT &&
          kb_waveform_read_envelope(path.c_str(), out.data(), 0) ==
              KB_ERROR_INVALID_ARGUMENT,
      "read envelope: a foreign file and zero buckets are refused"
  );
  std::filesystem::remove(path);
}

}  // namespace

void RunWritePeaksTests(const std::filesystem::path& dir) {
  TestQuantisedRoundTrip(dir);
  TestRefusals(dir);
  TestEnvelopeReads(dir);
  TestEnvelopeRefusals(dir);
}

}  // namespace analyze_test
