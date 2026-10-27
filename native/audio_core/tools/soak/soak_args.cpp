#include <cmath>
#include <cstdlib>
#include <fstream>

#include "click_classifier.h"
#include "metronome/metronome_internal.h"
#include "metronome/metronome_types.h"
#include "soak_cli.h"

namespace click_soak {

namespace {

using kitbag::kMaxBpm;
using kitbag::kMinBpm;
using kitbag::metronome_detail::kSecondsPerMinute;

// Absorbs decimal round-off, so a grid written as 0.15 s steps is 400 bpm.
constexpr double kSpacingSlackSec = 1e-9;
constexpr const char* kBlank = " \t\r";

ExitCode ParseNumber(
    const std::string& label,
    const std::string& text,
    double* out,
    std::string* error
) {
  char* end = nullptr;
  const double value = std::strtod(text.c_str(), &end);
  if (text.empty() || end != text.c_str() + text.size() ||
      !std::isfinite(value)) {
    *error = label + " '" + text + "' is not a finite number";
    return ExitCode::kInvalidMetadata;
  }
  *out = value;
  return ExitCode::kPass;
}

bool AlreadyGiven(const std::string& flag, const Options& options) {
  if (flag == "--grid") return !options.grid_path.empty();
  return flag == "--bpm" ? options.has_bpm : options.has_first_beat;
}

ExitCode ReadFlag(
    const std::vector<std::string>& args,
    size_t* index,
    Options* options,
    std::string* error
) {
  const std::string& flag = args[*index];
  if (flag != "--bpm" && flag != "--first-beat-ms" && flag != "--grid") {
    *error = "unknown option " + flag;
    return ExitCode::kUsage;
  }
  if (AlreadyGiven(flag, *options)) {
    *error = flag + " given more than once";
    return ExitCode::kUsage;
  }
  if (*index + 1 >= args.size()) {
    *error = flag + " needs a value";
    return ExitCode::kUsage;
  }
  const std::string& value = args[++*index];
  if (flag == "--grid") {
    options->grid_path = value;
    return ExitCode::kPass;
  }
  const bool bpm = flag == "--bpm";
  (bpm ? options->has_bpm : options->has_first_beat) = true;
  double* target = bpm ? &options->bpm : &options->first_beat_ms;
  return ParseNumber(flag, value, target, error);
}

ExitCode CheckOptions(const Options& options, std::string* error) {
  if (options.audio_path.empty()) {
    *error = "no audio file given";
    return ExitCode::kUsage;
  }
  if (options.has_bpm == !options.grid_path.empty()) {
    *error = "pass exactly one of --bpm or --grid";
    return ExitCode::kUsage;
  }
  if (options.has_first_beat && !options.has_bpm) {
    *error = "--first-beat-ms applies to --bpm only; a grid file is absolute";
    return ExitCode::kUsage;
  }
  if (options.has_bpm && (options.bpm < kMinBpm || options.bpm > kMaxBpm)) {
    *error = "--bpm " + Fixed(options.bpm) + " is outside the engine's " +
             Fixed(kMinBpm) + "-" + Fixed(kMaxBpm) + " range";
    return ExitCode::kInvalidMetadata;
  }
  if (options.has_first_beat && options.first_beat_ms < 0.0) {
    *error = "--first-beat-ms must not be negative";
    return ExitCode::kInvalidMetadata;
  }
  return ExitCode::kPass;
}

ExitCode CheckBeat(double previous, double beat, std::string* error) {
  if (beat < 0.0) {
    *error = "is negative";
    return ExitCode::kInvalidMetadata;
  }
  if (std::isnan(previous)) return ExitCode::kPass;
  const double spacing = beat - previous;
  if (spacing <= 0.0) {
    *error = "is not after the previous beat";
    return ExitCode::kInvalidMetadata;
  }
  if (spacing + kSpacingSlackSec < kSecondsPerMinute / kMaxBpm ||
      spacing - kSpacingSlackSec > kSecondsPerMinute / kMinBpm) {
    *error = "is " + Fixed(spacing) +
             " s after the previous beat, outside the engine's bpm range";
    return ExitCode::kInvalidMetadata;
  }
  return ExitCode::kPass;
}

ExitCode ReadGridLine(
    const std::string& where,
    const std::string& line,
    std::vector<double>* grid_sec,
    std::string* error
) {
  const size_t first = line.find_first_not_of(kBlank);
  if (first == std::string::npos) return ExitCode::kPass;
  const size_t last = line.find_last_not_of(kBlank);
  const std::string text = line.substr(first, last + 1 - first);
  double beat = 0.0;
  const ExitCode parsed = ParseNumber(where + ": beat", text, &beat, error);
  if (parsed != ExitCode::kPass) return parsed;
  const double previous = grid_sec->empty() ? NAN : grid_sec->back();
  std::string why;
  if (CheckBeat(previous, beat, &why) != ExitCode::kPass) {
    *error = where + ": beat " + text + " " + why;
    return ExitCode::kInvalidMetadata;
  }
  grid_sec->push_back(beat);
  return ExitCode::kPass;
}

}  // namespace

ExitCode ParseArgs(
    const std::vector<std::string>& args,
    Options* options,
    std::string* error
) {
  for (size_t i = 0; i < args.size(); ++i) {
    const std::string& arg = args[i];
    if (arg == "-h" || arg == "--help") {
      options->help = true;
      return ExitCode::kPass;
    }
    if (arg.size() > 1 && arg[0] == '-') {
      const ExitCode code = ReadFlag(args, &i, options, error);
      if (code != ExitCode::kPass) return code;
    } else if (options->audio_path.empty()) {
      options->audio_path = arg;
    } else {
      *error = "more than one audio file given";
      return ExitCode::kUsage;
    }
  }
  return CheckOptions(*options, error);
}

ExitCode LoadGridFile(
    const std::string& path,
    std::vector<double>* grid_sec,
    std::string* error
) {
  std::ifstream file(path);
  if (!file) {
    *error = "cannot read grid file " + path;
    return ExitCode::kInvalidMetadata;
  }
  std::string line;
  for (size_t number = 1; std::getline(file, line); ++number) {
    const std::string where = path + ":" + std::to_string(number);
    const ExitCode code = ReadGridLine(where, line, grid_sec, error);
    if (code != ExitCode::kPass) return code;
  }
  if (grid_sec->size() < kMinGridBeats) {
    *error = "grid file " + path + " holds fewer than " +
             std::to_string(kMinGridBeats) + " beats";
    return ExitCode::kInvalidMetadata;
  }
  return ExitCode::kPass;
}

// Runs past the recording by the most drift the tempo budget allows, so a
// recorder running fast still has a beat for its last clicks.
std::vector<double>
BpmGrid(double origin_sec, double bpm, double duration_sec) {
  const double interval = kSecondsPerMinute / bpm;
  const double end = duration_sec * (1.0 + kMaxTempoErrorPpm / kPpm) + interval;
  std::vector<double> grid;
  for (size_t beat = 0;; ++beat) {
    const double time = origin_sec + static_cast<double>(beat) * interval;
    if (time > end) break;
    grid.push_back(time);
  }
  return grid;
}

// A beat whose slot runs past the end of the recording cannot be judged.
std::vector<double>
TrimGrid(const std::vector<double>& grid_sec, double duration_sec) {
  std::vector<double> kept;
  for (size_t beat = 0; beat < grid_sec.size(); ++beat) {
    const double slot_end =
        grid_sec[beat] + kSlotHalfWidth * BeatSpacing(grid_sec, beat);
    if (slot_end > duration_sec) break;
    kept.push_back(grid_sec[beat]);
  }
  return kept;
}

}  // namespace click_soak
