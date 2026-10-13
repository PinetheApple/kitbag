#ifndef KITBAG_TOOLS_TUNER_TUNING_MODE_TEST_SUPPORT_H
#define KITBAG_TOOLS_TUNER_TUNING_MODE_TEST_SUPPORT_H

// Shared rig for tuner_verify's tuning-mode checks: the synthetic signals of
// docs/tuner-functional-spec.md §6, fed through the C ABI one hop at a time
// with one kb_tuner_state logged per hop.
#include "kitbag_api.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <functional>
#include <vector>

#include "check.h"

namespace tuning_test {

using kitbag_test::Check;

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kHop = 2048;  // spec P2
constexpr double kHopSeconds = static_cast<double>(kHop) / kSampleRate;
constexpr double kA4Hz = 440.0;
constexpr double kTau = 6.283185307179586;

constexpr int32_t kGuitar[] = {40, 45, 50, 55, 59, 64};
constexpr int32_t kBass4[] = {28, 33, 38, 43};
constexpr int32_t kUkulele[] = {67, 60, 64, 69};  // re-entrant G4 C4 E4 A4
constexpr int32_t kStringE2 = 0;
constexpr int32_t kStringG3 = 3;
constexpr int32_t kStringE4 = 5;

inline kb_engine* g_engine = nullptr;

struct Reading {
  double t;  // seconds from the scenario start to the end of this hop
  kb_tuner_state s;
};
using Log = std::vector<Reading>;
using SampleFn = std::function<float()>;

inline double MidiHz(double midi, double a4_hz = kA4Hz) {
  return a4_hz * std::exp2((midi - 69.0) / 12.0);
}
inline double Detune(double hz, double cents) {
  return hz * std::exp2(cents / 1200.0);
}
inline double GuitarHz(int32_t string) {
  return MidiHz(kGuitar[string]);
}

// Fundamental plus harmonics 2-5, each -6 dB below the last, peak -6 dBFS.
// Harmonics at or above Nyquist are dropped so a 12 kHz tone cannot alias.
class ToneOsc {
 public:
  static constexpr int kMaxHarmonics = 5;
  static constexpr double kPeak = 0.5011872336272722;  // -6 dBFS

  explicit ToneOsc(double gain = 1.0) : gain_(gain) {}

  float Next(double hz) {
    const int harmonics = HarmonicCount(hz);
    double sum = 0.0;
    for (int k = 1; k <= harmonics; ++k) {
      sum += Amplitude(k) * std::sin(kTau * k * phase_);
    }
    phase_ += hz / kSampleRate;
    phase_ -= std::floor(phase_);
    return static_cast<float>(sum * kPeak / PeakOf(harmonics) * gain_);
  }

  // RMS at gain 1, so a caller can scale a tone to an exact input level.
  static double UnitRms(double hz) {
    const int harmonics = HarmonicCount(hz);
    double power = 0.0;
    for (int k = 1; k <= harmonics; ++k) {
      power += Amplitude(k) * Amplitude(k) / 2.0;
    }
    return std::sqrt(power) * kPeak / PeakOf(harmonics);
  }

 private:
  static double Amplitude(int k) {
    return std::exp2(1 - k);
  }
  static int HarmonicCount(double hz) {
    int count = 1;
    while (count < kMaxHarmonics && (count + 1) * hz < kSampleRate / 2.0) {
      ++count;
    }
    return count;
  }
  // Peak of the unscaled waveform, computed once per harmonic count.
  static double PeakOf(int harmonics) {
    static const std::array<double, kMaxHarmonics + 1> kPeaks = [] {
      std::array<double, kMaxHarmonics + 1> peaks{};
      for (int h = 1; h <= kMaxHarmonics; ++h) peaks[h] = ScanPeak(h);
      return peaks;
    }();
    return kPeaks[harmonics];
  }
  static double ScanPeak(int harmonics) {
    constexpr int kPoints = 8192;
    double peak = 0.0;
    for (int i = 0; i < kPoints; ++i) {
      double sum = 0.0;
      for (int k = 1; k <= harmonics; ++k) {
        sum += Amplitude(k) * std::sin(kTau * k * i / kPoints);
      }
      peak = std::max(peak, std::fabs(sum));
    }
    return peak;
  }

  double phase_ = 0.0;
  double gain_;
};

// Deterministic white noise, uniform, at a given RMS.
class Noise {
 public:
  explicit Noise(double rms) : half_width_(rms * std::sqrt(3.0)) {}
  float Next() {
    state_ = state_ * 1664525u + 1013904223u;
    const double unit = static_cast<double>(state_) / 4294967296.0;
    return static_cast<float>((2.0 * unit - 1.0) * half_width_);
  }

 private:
  uint32_t state_ = 0x6b617462u;
  double half_width_;
};

inline float Silence() {
  return 0.0f;
}

// Restarts analysis on a fresh tuning; every scenario begins here.
inline void Begin(
    int32_t instrument,
    const int32_t* midis,
    int32_t count,
    double a4_hz = kA4Hz
) {
  kb_tuner_set_a4(g_engine, a4_hz);
  const bool ok =
      kb_tuner_set_tuning(g_engine, instrument, midis, count) == KB_OK &&
      kb_tuner_offline_init(g_engine, kSampleRate) == KB_OK;
  if (!ok) {
    std::fprintf(stderr, "SETUP FAILED: tuning or offline init rejected\n");
    ++kitbag_test::g_failures;
  }
}
inline void BeginManual(int32_t target_string) {
  Begin(KB_TUNER_INSTRUMENT_GUITAR, kGuitar, 6);
  if (kb_tuner_set_target_string(g_engine, target_string) != KB_OK) {
    std::fprintf(stderr, "SETUP FAILED: target string rejected\n");
    ++kitbag_test::g_failures;
  }
}
inline void BeginGuitar(double a4_hz = kA4Hz) {
  Begin(KB_TUNER_INSTRUMENT_GUITAR, kGuitar, 6, a4_hz);
}

inline int HopsFor(double seconds) {
  return static_cast<int>(std::ceil(seconds / kHopSeconds - 1e-9));
}

// Feeds `seconds` of fn, rounded up to whole hops, logging one reading per hop.
inline void Feed(Log* log, double seconds, const SampleFn& fn) {
  std::vector<float> block(kHop);
  for (int hop = 0; hop < HopsFor(seconds); ++hop) {
    std::generate(block.begin(), block.end(), fn);
    kb_tuner_offline_process(g_engine, block.data(), kHop);
    Reading reading{};
    reading.t = static_cast<double>(log->size() + 1) * kHopSeconds;
    kb_tuner_read_state(g_engine, &reading.s);
    log->push_back(reading);
  }
}

inline void FeedTone(Log* log, ToneOsc* osc, double seconds, double hz) {
  Feed(log, seconds, [osc, hz] { return osc->Next(hz); });
}

// The index of the last reading at or before `seconds`, or -1.
inline int IndexAt(const Log& log, double seconds) {
  int index = -1;
  for (size_t i = 0; i < log.size() && log[i].t <= seconds + 1e-9; ++i) {
    index = static_cast<int>(i);
  }
  return index;
}

using StatePred = std::function<bool(const kb_tuner_state&)>;

// True when pred holds at every reading from `from` to the end, and there is
// at least one such reading.
inline bool HoldsFrom(const Log& log, int from, const StatePred& pred) {
  if (from < 0 || from >= static_cast<int>(log.size())) return false;
  return std::all_of(log.begin() + from, log.end(), [&](const Reading& r) {
    return pred(r.s);
  });
}

// Seconds of the first reading at or after index `from` satisfying pred, or -1.
inline double FirstTime(const Log& log, int from, const StatePred& pred) {
  for (size_t i = std::max(from, 0); i < log.size(); ++i) {
    if (pred(log[i].s)) return log[i].t;
  }
  return -1.0;
}

inline StatePred OnString(int32_t string, double cents, double tolerance) {
  return [=](const kb_tuner_state& s) {
    return s.can_hear_note == 1 && s.current_string == string &&
           std::fabs(s.tuning_error_cents - cents) <= tolerance;
  };
}

inline bool NoString(const kb_tuner_state& s) {
  return s.current_string == KB_TUNER_NO_STRING;
}

// Seconds of audio the log has seen so far.
inline double Elapsed(const Log& log) {
  return log.empty() ? 0.0 : log.back().t;
}

// Feeds a clean tone and reports whether every reading from 600 ms after its
// start is on `string` within ±1 c of `cents` (spec T1/T2 settle budget).
inline bool
SettlesOn(Log* log, double seconds, double hz, int32_t string, double cents) {
  ToneOsc osc;
  const double start = Elapsed(*log);
  FeedTone(log, &osc, seconds, hz);
  return HoldsFrom(
      *log,
      IndexAt(*log, start + 0.6),
      OnString(string, cents, 1.0)
  );
}

// Liveness tail for the "nothing is reported" checks: a clean E4 appended to
// the scenario must be found, so a dead tuner cannot pass them.
inline bool FollowUpFindsE4(Log* log) {
  return SettlesOn(log, 1.0, GuitarHz(kStringE4), kStringE4, 0.0);
}

inline bool IsTuned(const kb_tuner_state& s) {
  return s.in_tune_ratio >= KB_TUNER_TUNED_RATIO;
}

inline bool NoHint(const kb_tuner_state& s) {
  return s.possible_wrong_string == KB_TUNER_NO_STRING &&
         s.wrong_string_direction == KB_WRONG_STRING_NONE;
}

inline bool NearHz(double measured, double expected, double fraction) {
  return std::fabs(measured / expected - 1.0) <= fraction;
}

// True when pred holds at every reading with t in (from_s, to_s], and there is
// at least one.
inline bool HoldsBetween(
    const Log& log,
    double from_s,
    double to_s,
    const StatePred& pred
) {
  int seen = 0;
  for (const Reading& r : log) {
    if (r.t <= from_s + 1e-9 || r.t > to_s + 1e-9) continue;
    if (!pred(r.s)) return false;
    ++seen;
  }
  return seen > 0;
}

// Check with a formatted name; on failure also prints the last reading, so a
// red run says what the tuner reported rather than only what it missed.
inline void Expect(bool ok, const Log& log, const char* format, ...) {
  char message[256];
  va_list args;
  va_start(args, format);
  std::vsnprintf(message, sizeof message, format, args);
  va_end(args);
  Check(ok, message);
  if (ok || log.empty()) return;
  const kb_tuner_state& s = log.back().s;
  std::fprintf(
      stderr,
      "      last @%.3fs: hear %d string %d err %+.2fc hz %.3f ratio %.2f "
      "status %d wrong %d/%d paused %d id %u\n",
      log.back().t,
      s.can_hear_note,
      s.current_string,
      s.tuning_error_cents,
      s.measured_hz,
      s.in_tune_ratio,
      s.tuning_status,
      s.possible_wrong_string,
      s.wrong_string_direction,
      s.listening_paused,
      s.measurement_id
  );
}

// Each file covers one group of docs/tuner-functional-spec.md §6; every check
// name starts with its T-id. T27-T29 are device-only and have no check here.
void RunDetectTests();       // T1-T5, T21
void RunTimingTests();       // T6-T9, T26
void RunWindowTests();       // T10-T13
void RunStabilityTests();    // T14-T16
void RunSilenceTests();      // T17-T20, T22
void RunWrongStringTests();  // T23-T25
void RunModeTests();         // no T-id: P18, chromatic, auto-mode hint
void RunEdgeTests();         // detector range and gates, chromatic/manual
void RunCounterTests();      // hint above, P10 costs, P19 hop, pause frame

}  // namespace tuning_test

#endif  // KITBAG_TOOLS_TUNER_TUNING_MODE_TEST_SUPPORT_H
