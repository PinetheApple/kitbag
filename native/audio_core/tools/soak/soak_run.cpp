#include <cmath>
#include <string>
#include <utility>
#include <vector>

#include "click_classifier.h"
#include "metronome/metronome_internal.h"
#include "soak_cli.h"
#include "soak_stats.h"

namespace click_soak {

namespace {

using kitbag::metronome_detail::kMsPerSecond;
using kitbag::metronome_detail::kSecondsPerMinute;

bool AutoOrigin(const Options& options) {
  return options.has_bpm && !options.has_first_beat;
}

double BeatSeconds(const Analysis& analysis) {
  if (analysis.options.has_bpm) return kSecondsPerMinute / analysis.options.bpm;
  std::vector<double> spacings;
  for (size_t i = 1; i < analysis.grid_sec.size(); ++i) {
    spacings.push_back(analysis.grid_sec[i] - analysis.grid_sec[i - 1]);
  }
  return UpperMedian(spacings);
}

std::vector<double> ExplicitGrid(
    const Options& options,
    std::vector<double> loaded_sec,
    double duration_sec
) {
  if (!options.has_bpm) return loaded_sec;
  const double origin_sec = options.first_beat_ms / kMsPerSecond;
  return BpmGrid(origin_sec, options.bpm, duration_sec);
}

std::string TooFewBeats(double duration_sec) {
  return "fewer than " + std::to_string(kMinGridBeats) +
         " grid beats fall inside the " + Fixed(duration_sec) + " s recording";
}

ExitCode LoadInputs(const std::vector<std::string>& args, Analysis* analysis) {
  Options& options = analysis->options;
  ExitCode code = ParseArgs(args, &options, &analysis->error);
  if (code != ExitCode::kPass || options.help) return code;
  std::vector<double> loaded_sec;
  if (!options.grid_path.empty()) {
    code = LoadGridFile(options.grid_path, &loaded_sec, &analysis->error);
    if (code != ExitCode::kPass) return code;
  }
  code = OpenAudio(options.audio_path, &analysis->audio, &analysis->error);
  if (code != ExitCode::kPass || AutoOrigin(options)) return code;
  const double duration = analysis->audio.duration_sec;
  analysis->grid_sec = ExplicitGrid(options, std::move(loaded_sec), duration);
  if (TrimGrid(analysis->grid_sec, duration).size() >= kMinGridBeats) {
    return ExitCode::kPass;
  }
  analysis->error = TooFewBeats(duration);
  return ExitCode::kInvalidMetadata;
}

ExitCode DetectClicks(Analysis* analysis, std::vector<double>* onsets) {
  const std::string& path = analysis->options.audio_path;
  const ExitCode code =
      DetectFileOnsets(path, BeatSeconds(*analysis), &analysis->levels, onsets);
  if (code == ExitCode::kUnreadableAudio) {
    analysis->error = path + " failed to decode";
    return code;
  }
  if (code == ExitCode::kPass && onsets->size() >= kMinClicks) return code;
  analysis->error = "detected " + std::to_string(onsets->size()) +
                    " click(s); at least " + std::to_string(kMinClicks) +
                    " are needed";
  return ExitCode::kNoClicks;
}

std::string Count(size_t count, const std::string& what) {
  return std::to_string(count) + " " + what + ", limit 0";
}

std::string OffsetFailure(const Report& report) {
  return "grid offset mean |x| over " + std::to_string(kOffsetWindowClicks) +
         " clicks from " + Fixed(report.offset_worst_window_sec) + " s is " +
         Fixed(report.offset_worst_window_ms) + " ms, limit " +
         Fixed(kMaxWindowOffsetMs) + " ms";
}

}  // namespace

std::vector<std::string> ThresholdFailures(const Report& report) {
  std::vector<std::string> failures;
  const std::string beyond = "more than " + Fixed(kJitterToleranceMs) + " ms";
  const auto fail_count = [&failures](size_t count, const std::string& what) {
    if (count > 0) failures.push_back(Count(count, what));
  };
  fail_count(report.dropped, "dropped click(s)");
  fail_count(report.doubled, "doubled click(s)");
  fail_count(report.jittered, "click(s) " + beyond + " off the local grid");
  fail_count(
      report.intervals_off,
      "interval(s) " + beyond + " off the grid spacing"
  );
  if (std::fabs(report.tempo_error_ppm) > kMaxTempoErrorPpm) {
    failures.push_back(
        "tempo error " + Fixed(report.tempo_error_ppm) + " ppm, limit +-" +
        Fixed(kMaxTempoErrorPpm) + " ppm"
    );
  }
  if (report.offset_gated &&
      report.offset_worst_window_ms > kMaxWindowOffsetMs) {
    failures.push_back(OffsetFailure(report));
  }
  return failures;
}

Analysis Analyse(const std::vector<std::string>& args) {
  Analysis analysis;
  const Options& options = analysis.options;
  analysis.code = LoadInputs(args, &analysis);
  if (analysis.code != ExitCode::kPass || options.help) return analysis;
  std::vector<double> onsets;
  analysis.code = DetectClicks(&analysis, &onsets);
  if (analysis.code != ExitCode::kPass) return analysis;
  if (AutoOrigin(options)) {
    const double duration = analysis.audio.duration_sec;
    analysis.grid_sec = BpmGrid(onsets.front(), options.bpm, duration);
  }
  if (TrimGrid(analysis.grid_sec, analysis.audio.duration_sec).size() <
      kMinGridBeats) {
    analysis.error = TooFewBeats(analysis.audio.duration_sec);
    analysis.code = ExitCode::kNoClicks;
    return analysis;
  }
  analysis.report =
      ClassifyClicks(onsets, analysis.grid_sec, analysis.audio.duration_sec);
  analysis.report.offset_gated = !AutoOrigin(options);
  analysis.failures = ThresholdFailures(analysis.report);
  if (!analysis.failures.empty()) analysis.code = ExitCode::kThresholdsFailed;
  return analysis;
}

}  // namespace click_soak
