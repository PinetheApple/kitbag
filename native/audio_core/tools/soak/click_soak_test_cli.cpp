#include <cstdio>
#include <fstream>

#include "soak_cli.h"
#include "soak_fixtures.h"
#include "wav_fixture.h"

namespace soak_test {

namespace {

using click_soak::Analyse;
using click_soak::Analysis;
using click_soak::ExitCode;

std::vector<float> Stereo(const std::vector<float>& mono) {
  std::vector<float> stereo;
  for (const float sample : mono) {
    stereo.push_back(sample);
    stereo.push_back(sample);
  }
  return stereo;
}

std::string
WriteTrain(const std::string& name, const std::vector<double>& clicks) {
  const std::string path = TempPath(name);
  const std::vector<float> mono = Synthesize(clicks, 1.0, kFileRate);
  Check(
      media_test::WriteFloatWav(path, Stereo(mono), 2, kFileRate),
      "cli: fixture WAV written"
  );
  return path;
}

std::string WriteText(const std::string& name, const std::string& text) {
  const std::string path = TempPath(name);
  std::ofstream(path) << text;
  return path;
}

std::string GridText(const std::vector<double>& grid) {
  std::string text;
  for (const double beat : grid) text += std::to_string(beat) + "\n";
  return text;
}

const std::string kFirstBeatMs = std::to_string(kFirstBeatSec * 1000.0);
const std::string kBpmText = std::to_string(kBpm);

void ExpectCode(
    const std::vector<std::string>& args,
    ExitCode code,
    const char* label
) {
  const Analysis analysis = Analyse(args);
  Check(analysis.code == code, label);
  if (analysis.code == code) return;
  std::fprintf(
      stderr,
      "  got exit %d: %s\n",
      static_cast<int>(analysis.code),
      analysis.error.c_str()
  );
}

void TestFileBpm(const std::string& wav) {
  const Analysis bpm =
      Analyse({wav, "--bpm", kBpmText, "--first-beat-ms", kFirstBeatMs});
  Check(bpm.code == ExitCode::kPass, "file: perfect train passes");
  Check(
      bpm.audio.sample_rate == kFileRate && bpm.audio.channels == 2,
      "file: 44.1 kHz stereo read"
  );
  Check(bpm.report.clicks_analysed == kBeats, "file: 40 clicks analysed");
  Check(
      bpm.report.offset_max_abs_ms <= 1.5 * 1000.0 / kFileRate,
      "file: offset within 1.5 samples"
  );
}

std::string CaptureRun(const std::vector<std::string>& args, int* code) {
  std::FILE* out = std::tmpfile();
  *code = click_soak::RunClickSoak(args, out, out);
  std::rewind(out);
  char text[4096] = {};
  std::fread(text, 1, sizeof(text) - 1, out);
  std::fclose(out);
  return text;
}

void TestFileGrid(const std::string& wav) {
  const std::string grid = WriteText("grid.txt", GridText(GridTimes()));
  const Analysis mapped = Analyse({wav, "--grid", grid});
  Check(mapped.code == ExitCode::kPass, "file: grid file passes");
  Check(mapped.report.beats_expected == kBeats, "file: grid of 40 beats");
  int code = -1;
  const std::string text = CaptureRun({wav, "--grid", grid}, &code);
  Check(
      code == 0 && text.find("RESULT: PASS") != std::string::npos,
      "file: report prints RESULT: PASS"
  );
  std::remove(grid.c_str());
}

void TestFileFaults() {
  auto missing = GridTimes();
  missing.erase(missing.begin() + 11);
  const std::string dropped = WriteTrain("dropped.wav", missing);
  const Analysis fail =
      Analyse({dropped, "--bpm", kBpmText, "--first-beat-ms", kFirstBeatMs});
  Check(
      fail.code == ExitCode::kThresholdsFailed,
      "file: dropped click fails the thresholds"
  );
  Check(
      fail.report.dropped == 1 && fail.failures.size() == 1,
      "file: exactly the drop is reported"
  );
  std::remove(dropped.c_str());
}

void TestFileOffset() {
  auto late = GridTimes();
  for (double& t : late) t += 0.008;
  const std::string shifted = WriteTrain("late.wav", late);
  ExpectCode(
      {shifted, "--bpm", kBpmText, "--first-beat-ms", kFirstBeatMs},
      ExitCode::kThresholdsFailed,
      "file: 8 ms offset fails with an explicit origin"
  );
  const Analysis automatic = Analyse({shifted, "--bpm", kBpmText});
  Check(
      automatic.code == ExitCode::kPass && !automatic.report.offset_gated,
      "file: first-click origin reports offset ungated"
  );
  std::remove(shifted.c_str());
}

struct ArgCase {
  std::vector<std::string> args;
  ExitCode code;
  const char* label;
};

const std::string kWav = "$wav";

const std::vector<ArgCase> kArgCases = {
    {{}, ExitCode::kUsage, "usage: no arguments"},
    {{kWav}, ExitCode::kUsage, "usage: neither --bpm nor --grid"},
    {{kWav, "--bpm", "120", "--grid", "g.txt"},
     ExitCode::kUsage,
     "usage: both --bpm and --grid"},
    {{kWav, "--grid", "g.txt", "--first-beat-ms", "5"},
     ExitCode::kUsage,
     "usage: --first-beat-ms with --grid"},
    {{kWav, "--bpm"}, ExitCode::kUsage, "usage: --bpm without a value"},
    {{kWav, "--tempo", "120"}, ExitCode::kUsage, "usage: unknown option"},
    {{kWav, kWav, "--bpm", "120"}, ExitCode::kUsage, "usage: two audio files"},
    {{kWav, "--bpm", "120", "--bpm", "121"},
     ExitCode::kUsage,
     "usage: --bpm twice"},
    {{kWav, "--grid", "a.txt", "--grid", "b.txt"},
     ExitCode::kUsage,
     "usage: --grid twice"},
    {{kWav, "--bpm", "120", "--first-beat-ms", "0", "--first-beat-ms", "5"},
     ExitCode::kUsage,
     "usage: --first-beat-ms twice"},
    {{kWav, "--bpm", "abc"},
     ExitCode::kInvalidMetadata,
     "metadata: bpm not a number"},
    {{kWav, "--bpm", "19.9"},
     ExitCode::kInvalidMetadata,
     "metadata: bpm below kMinBpm"},
    {{kWav, "--bpm", "400.1"},
     ExitCode::kInvalidMetadata,
     "metadata: bpm above kMaxBpm"},
    {{kWav, "--bpm", "120", "--first-beat-ms", "-1"},
     ExitCode::kInvalidMetadata,
     "metadata: negative first beat"},
    {{kWav, "--bpm", "120", "--first-beat-ms", "21000"},
     ExitCode::kInvalidMetadata,
     "metadata: first beat leaves < 2 beats"},
    {{"absent.wav", "--bpm", "500"},
     ExitCode::kInvalidMetadata,
     "metadata: checked before the audio is opened"},
};

void TestUsageAndMetadata(const std::string& wav) {
  for (ArgCase test : kArgCases) {
    for (std::string& arg : test.args) {
      if (arg == kWav) arg = wav;
    }
    ExpectCode(test.args, test.code, test.label);
  }
}

struct GridCase {
  std::string text;
  const char* reason;
  const char* label;
};

const std::vector<GridCase> kBadGrids = {
    {"0.5\n0.4\n0.9\n", "not after the previous beat", "grid: not increasing"},
    {"0.5\n", "fewer than 2 beats", "grid: one beat"},
    {"0.5\n0.9x\n", "not a finite number", "grid: unparseable line"},
    {"0.5\n0.6\n",
     "outside the engine's bpm range",
     "grid: spacing above kMaxBpm"},
    {"30.0\n30.5\n", "fall inside", "grid: beats past the recording"},
};

void TestGridFiles(const std::string& wav) {
  for (const GridCase& test : kBadGrids) {
    const std::string path = WriteText("bad_grid.txt", test.text);
    const Analysis analysis = Analyse({wav, "--grid", path});
    Check(analysis.code == ExitCode::kInvalidMetadata, test.label);
    Check(analysis.error.find(test.reason) != std::string::npos, test.label);
    std::remove(path.c_str());
  }
  ExpectCode(
      {wav, "--grid", TempPath("absent.txt")},
      ExitCode::kInvalidMetadata,
      "grid: unreadable file"
  );
  const std::string first = std::to_string(GridTimes()[0]);
  const std::string second = std::to_string(GridTimes()[1]);
  const std::string blank =
      WriteText("blank_grid.txt", "\n " + first + " \n\n" + second + "\r\n");
  ExpectCode(
      {wav, "--grid", blank},
      ExitCode::kPass,
      "grid: blank lines and CRLF tolerated"
  );
  std::remove(blank.c_str());
}

void TestUnreadableInput() {
  const std::string text =
      WriteText("not_audio.wav", "this is not a recording\n");
  ExpectCode(
      {text, "--bpm", "120"},
      ExitCode::kUnreadableAudio,
      "input: text file is not audio"
  );
  std::remove(text.c_str());
  ExpectCode(
      {TempPath("absent.wav"), "--bpm", "120"},
      ExitCode::kUnreadableAudio,
      "input: missing file"
  );
  const std::string silent = TempPath("silent.wav");
  media_test::WriteFloatWav(
      silent,
      std::vector<float>(2 * kFileRate * 3, 0.0F),
      2,
      kFileRate
  );
  ExpectCode(
      {silent, "--bpm", "120", "--first-beat-ms", "0"},
      ExitCode::kNoClicks,
      "input: silence has no clicks"
  );
  std::remove(silent.c_str());
}

}  // namespace

void RunCliTests() {
  const std::string wav = WriteTrain("perfect.wav", GridTimes());
  TestFileBpm(wav);
  TestFileGrid(wav);
  TestFileFaults();
  TestFileOffset();
  TestUsageAndMetadata(wav);
  TestGridFiles(wav);
  TestUnreadableInput();
  std::remove(wav.c_str());
}

}  // namespace soak_test
