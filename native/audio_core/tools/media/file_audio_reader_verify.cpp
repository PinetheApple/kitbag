// The other side of the SourceReader seam: the miniaudio adapter over a real
// file. AudioSource's suite proves the module works without miniaudio; this
// proves the adapter decodes what it claims to.
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "check.h"
#include "media/audio_source.h"
#include "media/file_audio_reader.h"
#include "media_test_support.h"
#include "wav_fixture.h"

namespace {

constexpr int kExpectedChecks = 14;
constexpr uint64_t kFixtureFrames = 1000;

using kitbag::FileAudioReader;

float Expected(uint64_t index) {
  return static_cast<float>(media_test::FixtureSample(index)) /
         media_test::kS16Scale;
}

void TestMetadata(FileAudioReader* reader) {
  kitbag_test::Check(reader->channels() == 2, "file: channel count");
  kitbag_test::Check(reader->sample_rate() == 44100, "file: sample rate");
  kitbag_test::Check(
      reader->total_frames() == kFixtureFrames,
      "file: frame count"
  );
}

// The bug this tool exists for: a 16-bit file decoded into a float* without a
// format conversion left half of dst untouched and the rest denormal noise.
void TestDecodesToFloat(FileAudioReader* reader) {
  std::vector<float> dst(8, media_test::kPoison);
  const kitbag::ReadResult result = reader->ReadFrames(dst.data(), 4);
  kitbag_test::Check(result.frames == 4, "file: reads the frames asked for");
  kitbag_test::Check(
      result.status == kitbag::ReadStatus::kOk,
      "file: a satisfied read is kOk"
  );
  bool exact = true;
  for (uint64_t i = 0; i < 8; ++i) {
    if (dst[i] != Expected(i)) exact = false;
  }
  kitbag_test::Check(exact, "file: s16 converts to the exact float value");
}

void TestSeekAndEnd(FileAudioReader* reader) {
  kitbag_test::Check(reader->SeekToFrame(kFixtureFrames - 2), "file: seeks");
  std::vector<float> dst(8, media_test::kPoison);
  const kitbag::ReadResult result = reader->ReadFrames(dst.data(), 4);
  kitbag_test::Check(result.frames == 2, "file: short read at the end");
  kitbag_test::Check(
      result.status == kitbag::ReadStatus::kEndOfStream,
      "file: a short read reports end of stream"
  );
  kitbag_test::Check(
      dst[0] == Expected((kFixtureFrames - 2) * media_test::kFixtureChannels),
      "file: the seek lands on the right frame"
  );
  kitbag_test::Check(
      !reader->SeekToFrame(kFixtureFrames + 100),
      "file: seek past the end fails"
  );
}

void TestUnopened() {
  FileAudioReader reader;
  kitbag_test::Check(
      !reader.Open("/nonexistent/kitbag.wav"),
      "file: open fails"
  );
  std::vector<float> dst(4, media_test::kPoison);
  kitbag_test::Check(
      reader.ReadFrames(dst.data(), 2).frames == 0,
      "file: an unopened reader delivers nothing"
  );
}

bool RunAll(const std::filesystem::path& path) {
  if (!media_test::WriteWav(path.string(), kFixtureFrames)) {
    std::fprintf(
        stderr,
        "file_audio_reader_verify: cannot write the fixture\n"
    );
    return false;
  }
  FileAudioReader reader;
  kitbag_test::Check(reader.Open(path.string().c_str()), "file: opens the wav");
  TestMetadata(&reader);
  TestDecodesToFloat(&reader);
  TestSeekAndEnd(&reader);
  reader.Close();
  TestUnopened();
  std::filesystem::remove(path);
  return true;
}

}  // namespace

int main() {
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "kitbag_fixture_s16.wav";
  if (!RunAll(path)) return 1;

  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "file_audio_reader_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("file_audio_reader_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "file_audio_reader_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
