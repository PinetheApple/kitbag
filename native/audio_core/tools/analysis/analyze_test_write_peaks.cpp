// kb_waveform_write_peaks writes StemDeck's precomputed peaks as a sidecar; it
// must be byte-compatible with the one kb_analyze_song writes.
#include "kitbag_api.h"

#include <cstddef>
#include <cstdint>
#include <filesystem>
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

}  // namespace

void RunWritePeaksTests(const std::filesystem::path& dir) {
  TestQuantisedRoundTrip(dir);
  TestRefusals(dir);
}

}  // namespace analyze_test
