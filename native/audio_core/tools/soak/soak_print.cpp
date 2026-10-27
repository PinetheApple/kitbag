#include "metronome/metronome_types.h"
#include "soak_cli.h"

namespace click_soak {

namespace {

struct ExitInfo {
  ExitCode code;
  const char* meaning;
};

constexpr ExitInfo kExitTable[] = {
    {ExitCode::kPass, "every click judged and within every threshold"},
    {ExitCode::kThresholdsFailed, "a threshold failed; the report says which"},
    {ExitCode::kUsage, "usage error"},
    {ExitCode::kUnreadableAudio, "input is not readable audio"},
    {ExitCode::kInvalidMetadata, "invalid metadata: bpm, first beat or grid"},
    {ExitCode::kNoClicks, "too few clicks detected to judge"},
};

const char* Meaning(ExitCode code) {
  for (const ExitInfo& info : kExitTable) {
    if (info.code == code) return info.meaning;
  }
  return "unknown";
}

std::string Signed(double value) {
  return (value >= 0.0 ? "+" : "") + Fixed(value);
}

struct EventList {
  const char* label;
  const char* value_meaning;
  size_t total;
  const std::vector<Event>& events;
};

void PrintEvents(const EventList& list, std::FILE* out) {
  for (const Event& event : list.events) {
    std::fprintf(
        out,
        "    %s at %s s",
        list.label,
        Fixed(event.time_sec).c_str()
    );
    if (list.value_meaning != nullptr) {
      std::fprintf(
          out,
          ", %s ms %s",
          Signed(event.value_ms).c_str(),
          list.value_meaning
      );
    }
    std::fputc('\n', out);
  }
  if (list.total > list.events.size()) {
    std::fprintf(out, "    ... %zu more\n", list.total - list.events.size());
  }
}

void PrintGrid(const Analysis& analysis, std::FILE* out) {
  const Options& options = analysis.options;
  const size_t beats = analysis.report.beats_expected;
  if (!options.has_bpm) {
    std::fprintf(
        out,
        "  grid         %s, %zu beats in the recording\n",
        options.grid_path.c_str(),
        beats
    );
  } else if (options.has_first_beat) {
    std::fprintf(
        out,
        "  grid         %s bpm from %s ms, %zu beats\n",
        Fixed(options.bpm).c_str(),
        Fixed(options.first_beat_ms).c_str(),
        beats
    );
  } else {
    std::fprintf(
        out,
        "  grid         %s bpm from the first click, %zu beats (offset not "
        "gated)\n",
        Fixed(options.bpm).c_str(),
        beats
    );
  }
}

void PrintDetection(const Analysis& analysis, std::FILE* out) {
  const AudioInfo& audio = analysis.audio;
  const DetectionLevels& levels = analysis.levels;
  std::fprintf(
      out,
      "  audio        %u Hz, %u ch, %s s\n",
      audio.sample_rate,
      audio.channels,
      Fixed(audio.duration_sec).c_str()
  );
  PrintGrid(analysis, out);
  std::fprintf(
      out,
      "  detection    threshold %.4f (click peak %.4f, noise floor %.4f)\n",
      levels.threshold,
      levels.click_peak,
      levels.noise_floor
  );
}

void PrintIntervals(const Report& r, std::FILE* out) {
  std::fprintf(
      out,
      "  clicks       %zu analysed of %zu beats; %zu onsets, %zu outside the "
      "grid\n",
      r.clicks_analysed,
      r.beats_expected,
      r.onsets_detected,
      r.outside_grid
  );
  std::fprintf(
      out,
      "  intervals    %zu; error ms mean %s, |error| p50 %s p95 %s p99 %s max "
      "%s\n",
      r.intervals,
      Signed(r.error_mean_ms).c_str(),
      Fixed(r.error_p50_ms).c_str(),
      Fixed(r.error_p95_ms).c_str(),
      Fixed(r.error_p99_ms).c_str(),
      Fixed(r.error_max_abs_ms).c_str()
  );
}

void PrintTiming(const Report& r, std::FILE* out) {
  std::fprintf(
      out,
      "  tempo        %s ppm against the grid (limit +-%s ppm)\n",
      Signed(r.tempo_error_ppm).c_str(),
      Fixed(kMaxTempoErrorPpm).c_str()
  );
  std::fprintf(
      out,
      "  max error    %s ms from the local grid (jitter limit %s ms)\n",
      Fixed(r.deviation_max_abs_ms).c_str(),
      Fixed(kJitterToleranceMs).c_str()
  );
}

void PrintFaults(const Report& r, std::FILE* out) {
  std::fprintf(out, "  dropped      %zu\n", r.dropped);
  PrintEvents({"beat", nullptr, r.dropped, r.dropped_at}, out);
  std::fprintf(out, "  doubled      %zu\n", r.doubled);
  PrintEvents({"extra", "from the beat's click", r.doubled, r.doubled_at}, out);
  std::fprintf(out, "  jittered     %zu\n", r.jittered);
  PrintEvents({"click", "from the local grid", r.jittered, r.jittered_at}, out);
  std::fprintf(out, "  off-interval %zu\n", r.intervals_off);
  PrintEvents(
      {"interval ending",
       "from the grid spacing",
       r.intervals_off,
       r.intervals_off_at},
      out
  );
}

void PrintOffset(const Report& r, std::FILE* out) {
  std::fprintf(
      out,
      "  grid offset  mean %s ms, mean |x| %s ms, max |x| %s ms\n",
      Signed(r.offset_mean_ms).c_str(),
      Fixed(r.offset_mean_abs_ms).c_str(),
      Fixed(r.offset_max_abs_ms).c_str()
  );
  std::fprintf(
      out,
      "  worst window mean |x| %s ms over %zu clicks from %s s (limit %s "
      "ms%s)\n",
      Fixed(r.offset_worst_window_ms).c_str(),
      kOffsetWindowClicks,
      Fixed(r.offset_worst_window_sec).c_str(),
      Fixed(kMaxWindowOffsetMs).c_str(),
      r.offset_gated ? "" : ", not gated"
  );
}

}  // namespace

void PrintUsage(std::FILE* out) {
  std::fprintf(
      out,
      "usage: click_soak <recording> --bpm <bpm> [--first-beat-ms <ms>]\n"
      "       click_soak <recording> --grid <beats.txt>\n\n"
      "Detects clicks in a recorded or rendered metronome (WAV, FLAC, MP3) "
      "and\n"
      "judges them against the expected grid: dropped and doubled clicks,\n"
      "per-click jitter, interval error and click-vs-grid offset.\n\n"
      "  --bpm <bpm>           constant tempo, %s-%s\n"
      "  --first-beat-ms <ms>  beat 1 in the recording; without it the first\n"
      "                        click is the origin and offset is not gated\n"
      "  --grid <file>         one beat time in seconds per line\n\n"
      "A second click less than ~50 ms after the first (measured on the\n"
      "default sound; longer for slower-decaying sounds) merges into one\n"
      "onset and is not counted as doubled. Record with the default click\n"
      "sound: a low preset (tom) through a resonant speaker can time accents\n"
      "and beats on different half-cycles, ~1.4 ms apart, read as jitter.\n\n",
      Fixed(kitbag::kMinBpm).c_str(),
      Fixed(kitbag::kMaxBpm).c_str()
  );
  for (const ExitInfo& info : kExitTable) {
    std::fprintf(
        out,
        "exit %d  %s\n",
        static_cast<int>(info.code),
        info.meaning
    );
  }
}

void PrintAnalysis(const Analysis& analysis, std::FILE* out) {
  std::fprintf(out, "click_soak: %s\n", analysis.options.audio_path.c_str());
  PrintDetection(analysis, out);
  PrintIntervals(analysis.report, out);
  PrintTiming(analysis.report, out);
  PrintFaults(analysis.report, out);
  PrintOffset(analysis.report, out);
  for (const std::string& failure : analysis.failures) {
    std::fprintf(out, "FAIL: %s\n", failure.c_str());
  }
  std::fprintf(
      out,
      "RESULT: %s\n",
      analysis.failures.empty() ? "PASS" : "FAIL"
  );
}

int RunClickSoak(
    const std::vector<std::string>& args,
    std::FILE* out,
    std::FILE* err
) {
  const Analysis analysis = Analyse(args);
  if (analysis.options.help) {
    PrintUsage(out);
    return static_cast<int>(ExitCode::kPass);
  }
  const bool judged = analysis.code == ExitCode::kPass ||
                      analysis.code == ExitCode::kThresholdsFailed;
  if (judged) {
    PrintAnalysis(analysis, out);
  } else {
    std::fprintf(err, "click_soak: %s\n", analysis.error.c_str());
    std::fprintf(
        err,
        "exit %d: %s\n",
        static_cast<int>(analysis.code),
        Meaning(analysis.code)
    );
    if (analysis.code == ExitCode::kUsage) PrintUsage(err);
  }
  return static_cast<int>(analysis.code);
}

}  // namespace click_soak
