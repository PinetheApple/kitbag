#include <cstdint>
#include <limits>
#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kMsPerSecond;

constexpr int64_t kRiseHoldFrames = 64;
constexpr int64_t kNeverFrame = std::numeric_limits<int64_t>::max();
constexpr double kNoRamp = 0.0;
constexpr int kPolyBeats = 3;
constexpr double kSmallestOffsetMs = 0.5;
constexpr double kMaxOffsetMs = kitbag::Metronome::kMaxLatencyOffsetMs;
constexpr double kSwitchSeconds = 5.3;
constexpr double kPreRollSongSeconds = -1.0;
constexpr double kPreRollRenderSeconds = 1.5;

struct FreeRun {
  double start_bpm;
  double target_bpm = 0.0;
  double step_bpm = kNoRamp;
  double interval = 1.0;
  int32_t unit = kRampBars;
  int subdivision = 1;
  bool bar_mute = false;
  bool poly = false;
  double seconds;
};

struct OffsetPlan {
  double start_ms;
  double switch_ms;
  int64_t switch_frame;
};

constexpr FreeRun kDownbeatRun{.start_bpm = 120.0, .seconds = 4.0};
constexpr FreeRun kRampDown{
    .start_bpm = 211.0,
    .target_bpm = 97.0,
    .step_bpm = 19.0,
    .seconds = 20.0
};

constexpr FreeRun kRuns[] = {
    kRampDown,
    {.start_bpm = 97.0, .target_bpm = 211.0, .step_bpm = 19.0, .seconds = 16.0},
    {.start_bpm = 211.0,
     .target_bpm = 97.0,
     .step_bpm = 19.0,
     .interval = 1.3,
     .unit = kRampSeconds,
     .subdivision = 3,
     .seconds = 16.0},
    {.start_bpm = 131.0, .subdivision = 2, .bar_mute = true, .seconds = 16.0},
    {.start_bpm = 211.0,
     .target_bpm = 97.0,
     .step_bpm = 19.0,
     .bar_mute = true,
     .seconds = 24.0},
    {.start_bpm = 211.0,
     .target_bpm = 97.0,
     .step_bpm = 19.0,
     .poly = true,
     .seconds = 20.0},
    {.start_bpm = kitbag::kMinBpm, .subdivision = 3, .seconds = 40.0},
    {.start_bpm = kitbag::kMinBpm,
     .target_bpm = 39.0,
     .step_bpm = 7.0,
     .seconds = 60.0},
    {.start_bpm = kitbag::kMaxBpm,
     .target_bpm = 353.0,
     .step_bpm = 16.0,
     .subdivision = 4,
     .seconds = 8.0},
    {.start_bpm = kitbag::kMaxBpm,
     .subdivision = kitbag::Metronome::kMaxSubdivision,
     .seconds = 6.0},
};

void Configure(kitbag::Metronome& metronome, const FreeRun& run) {
  metronome.SetTempo(run.start_bpm);
  metronome.SetTimeSignature(4, 4);
  metronome.SetSubdivision(run.subdivision);
  metronome.SetSounds(kTickSound, kTickSound);
  if (run.bar_mute) metronome.SetBarMute(true, 1, 1);
  if (run.poly) metronome.SetPolyrhythm(true, kPolyBeats);
  if (run.step_bpm == kNoRamp) return;
  metronome.SetRamp(
      true,
      run.start_bpm,
      run.target_bpm,
      run.step_bpm,
      run.interval,
      run.unit,
      false
  );
}

std::vector<int64_t> RiseFrames(const std::vector<float>& samples) {
  const double decay = std::exp(-kTickDecayPerSecond / kSampleRate);
  std::vector<int64_t> rises;
  double envelope = 0.0;
  int64_t last = -kRiseHoldFrames;
  for (size_t i = 0; i < samples.size(); ++i) {
    const double level = std::fabs(static_cast<double>(samples[i]));
    const auto frame = static_cast<int64_t>(i);
    if (level > envelope + kMinTickRise && frame - last >= kRiseHoldFrames) {
      rises.push_back(frame);
      last = frame;
    }
    envelope = std::max(level, envelope * decay);
  }
  return rises;
}

std::vector<int64_t> RenderRises(const FreeRun& run, const OffsetPlan& plan) {
  kitbag::Metronome metronome;
  Configure(metronome, run);
  metronome.SetLatencyOffset(plan.start_ms);
  metronome.Start();
  const auto on_block = OnceAtFrame(plan.switch_frame, [&](int64_t) {
    metronome.SetLatencyOffset(plan.switch_ms);
  });
  return RiseFrames(RenderLeft(metronome, FramesFor(run.seconds), on_block));
}

std::vector<int64_t> RenderRises(const FreeRun& run, double offset_ms) {
  return RenderRises(run, {offset_ms, offset_ms, kNeverFrame});
}

size_t FirstMismatch(
    const std::vector<int64_t>& without,
    const std::vector<int64_t>& with
) {
  const size_t count = std::min(without.size(), with.size());
  for (size_t i = 0; i < count; ++i) {
    if (std::llabs(with[i] - without[i]) > kFrameSlack) return i;
  }
  return count;
}

int64_t At(const std::vector<int64_t>& frames, size_t index) {
  return index < frames.size() ? frames[index] : -1;
}

std::string Describe(const FreeRun& run) {
  char text[64];
  if (run.step_bpm == kNoRamp) {
    std::snprintf(text, sizeof text, "%.0f BPM", run.start_bpm);
  } else {
    std::snprintf(
        text,
        sizeof text,
        "%s ramp %.0f->%.0f",
        run.unit == kRampSeconds ? "time" : "bar",
        run.start_bpm,
        run.target_bpm
    );
  }
  std::string out = text;
  if (run.subdivision > 1) out += " sub " + std::to_string(run.subdivision);
  if (run.bar_mute) out += " + bar mute";
  if (run.poly) out += " + poly " + std::to_string(kPolyBeats);
  return out;
}

std::string Label(const FreeRun& run, const OffsetPlan& plan) {
  char text[128];
  std::snprintf(
      text,
      sizeof text,
      "free run %s, %+.1f -> %+.1f ms",
      Describe(run).c_str(),
      plan.start_ms,
      plan.switch_ms
  );
  return text;
}

void ExpectInert(const FreeRun& run, const OffsetPlan& plan) {
  const auto without = RenderRises(run, 0.0);
  const auto with = RenderRises(run, plan);
  const size_t index = FirstMismatch(without, with);
  const bool same = without.size() == with.size() && index == with.size();
  char detail[160];
  std::snprintf(
      detail,
      sizeof detail,
      "%zu clicks vs %zu at 0 ms; click %zu at frame %lld, 0 ms has %lld",
      with.size(),
      without.size(),
      index,
      static_cast<long long>(At(with, index)),
      static_cast<long long>(At(without, index))
  );
  CheckCase(same && !without.empty(), Label(run, plan), detail);
}

void ExpectDownbeatAtFrameZero(double offset_ms) {
  const auto rises = RenderRises(kDownbeatRun, offset_ms);
  char detail[64];
  std::snprintf(
      detail,
      sizeof detail,
      "first click at frame %lld",
      static_cast<long long>(At(rises, 0))
  );
  CheckCase(
      !rises.empty() && rises[0] <= kFrameSlack,
      Label(kDownbeatRun, {offset_ms, offset_ms, kNeverFrame}),
      detail
  );
}

std::vector<int64_t> RenderPreRollRises(double offset_ms, double seconds) {
  kitbag::Metronome metronome;
  metronome.SetTimeSignature(4, 4);
  metronome.SetSubdivision(kitbag::Metronome::kMaxSubdivision);
  metronome.SetSounds(kTickSound, kTickSound);
  metronome.SetLatencyOffset(offset_ms);
  metronome.AnchorExternal(kPreRollSongSeconds, 0, kitbag::kMaxBpm);
  return RiseFrames(RenderLeft(metronome, FramesFor(seconds)));
}

std::vector<int64_t>
ShiftedWithin(const std::vector<int64_t>& frames, int64_t shift, int64_t end) {
  std::vector<int64_t> shifted;
  for (const int64_t frame : frames) {
    const int64_t moved = frame + shift;
    if (moved >= 0 && moved < end) shifted.push_back(moved);
  }
  return shifted;
}

struct PreRollResult {
  std::vector<int64_t> seen;
  std::vector<int64_t> want;
  size_t index;
  int64_t beat_zero;
};

std::string PreRollDetail(const PreRollResult& r) {
  char detail[192];
  std::snprintf(
      detail,
      sizeof detail,
      "first click %lld, beat 0 at %lld; %zu clicks vs %zu; click %zu at %lld, "
      "0 ms run has %lld",
      static_cast<long long>(At(r.seen, 0)),
      static_cast<long long>(r.beat_zero),
      r.seen.size(),
      r.want.size(),
      r.index,
      static_cast<long long>(At(r.seen, r.index)),
      static_cast<long long>(At(r.want, r.index))
  );
  return detail;
}

PreRollResult MeasurePreRoll(double offset_ms) {
  const auto early =
      static_cast<int64_t>(std::lround(offset_ms / kMsPerSecond * kSampleRate));
  const double reference_seconds =
      kPreRollRenderSeconds + std::fabs(offset_ms) / kMsPerSecond;
  const int64_t end = FramesFor(kPreRollRenderSeconds) - kRiseHoldFrames;
  PreRollResult r;
  r.want =
      ShiftedWithin(RenderPreRollRises(0.0, reference_seconds), -early, end);
  r.seen = ShiftedWithin(
      RenderPreRollRises(offset_ms, kPreRollRenderSeconds),
      0,
      end
  );
  r.index = FirstMismatch(r.want, r.seen);
  r.beat_zero = FramesFor(-kPreRollSongSeconds) - early;
  return r;
}

std::string PreRollLabel(double offset_ms) {
  char label[96];
  std::snprintf(
      label,
      sizeof label,
      "pre-roll anchor %.0f BPM sub %d, %+.1f ms: silent until song beat 0",
      kitbag::kMaxBpm,
      kitbag::Metronome::kMaxSubdivision,
      offset_ms
  );
  return label;
}

void ExpectSilentBeforeSongBeatZero(double offset_ms) {
  const PreRollResult r = MeasurePreRoll(offset_ms);
  const bool starts_on_beat_zero =
      !r.seen.empty() && std::llabs(r.seen[0] - r.beat_zero) <= kFrameSlack;
  CheckCase(
      starts_on_beat_zero && r.seen.size() == r.want.size() &&
          r.index == r.want.size(),
      PreRollLabel(offset_ms),
      PreRollDetail(r).c_str()
  );
}

}  // namespace

void RunLatencyFreeRunTests() {
  for (const double offset : {kSmallestOffsetMs, kMaxOffsetMs, -kMaxOffsetMs}) {
    ExpectDownbeatAtFrameZero(offset);
  }
  for (const FreeRun& run : kRuns) {
    ExpectInert(run, {kMaxOffsetMs, kMaxOffsetMs, kNeverFrame});
    ExpectInert(run, {-kMaxOffsetMs, -kMaxOffsetMs, kNeverFrame});
  }
  ExpectInert(
      kRampDown,
      {-kMaxOffsetMs, kMaxOffsetMs, FramesFor(kSwitchSeconds)}
  );
  ExpectSilentBeforeSongBeatZero(kMaxOffsetMs);
  ExpectSilentBeforeSongBeatZero(-kMaxOffsetMs);
}

}  // namespace metronome_test
