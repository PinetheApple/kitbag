#ifndef KITBAG_TOOLS_SOAK_SOAK_CLI_H
#define KITBAG_TOOLS_SOAK_SOAK_CLI_H

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "click_soak_types.h"
#include "onset_detector.h"

namespace click_soak {

struct Options {
  std::string audio_path;
  std::string grid_path;
  double bpm = 0.0;
  double first_beat_ms = 0.0;
  bool has_bpm = false;
  bool has_first_beat = false;
  bool help = false;
};

struct AudioInfo {
  uint32_t sample_rate = 0;
  uint32_t channels = 0;
  uint64_t frames = 0;
  double duration_sec = 0.0;
};

struct Analysis {
  ExitCode code = ExitCode::kPass;
  std::string error;
  Options options;
  AudioInfo audio;
  DetectionLevels levels;
  std::vector<double> grid_sec;
  Report report;
  std::vector<std::string> failures;
};

ExitCode ParseArgs(
    const std::vector<std::string>& args,
    Options* options,
    std::string* error
);
ExitCode LoadGridFile(
    const std::string& path,
    std::vector<double>* grid_sec,
    std::string* error
);
ExitCode
OpenAudio(const std::string& path, AudioInfo* info, std::string* error);
ExitCode DetectFileOnsets(
    const std::string& path,
    double beat_sec,
    DetectionLevels* levels,
    std::vector<double>* onsets_sec
);

std::vector<double> BpmGrid(double origin_sec, double bpm, double duration_sec);
std::vector<double>
TrimGrid(const std::vector<double>& grid_sec, double duration_sec);
std::vector<std::string> ThresholdFailures(const Report& report);

Analysis Analyse(const std::vector<std::string>& args);
void PrintUsage(std::FILE* out);
void PrintAnalysis(const Analysis& analysis, std::FILE* out);
int RunClickSoak(
    const std::vector<std::string>& args,
    std::FILE* out,
    std::FILE* err
);

inline std::string Fixed(double value) {
  char text[64];
  std::snprintf(text, sizeof(text), "%.3f", value);
  return text;
}

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_SOAK_CLI_H
