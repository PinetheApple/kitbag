#include "kitbag_api.h"

#include "tuner/tuning_rules.h"

#include <cmath>

namespace kitbag::tuning_rules {

namespace {

constexpr double kMidiA4 = 69.0;
constexpr double kSemitonesPerOctave = 12.0;

constexpr double kTightCents = 7.0;
constexpr double kMidCents = 10.0;
constexpr double kWideCents = 12.0;
constexpr double kUkuleleLowCents = 14.0;
constexpr int32_t kGuitarLowMaxMidi = 42;  // E2, F2, F#2
constexpr int32_t kBassLowMaxMidi = 30;    // up to F#1
constexpr int32_t kBassMidMaxMidi = 40;    // up to E2
constexpr int32_t kUkuleleHighMidi = 63;   // D#4 and above
constexpr int32_t kStatusInTuneCents = 7;  // P18

}  // namespace

double InTuneWindowCents(int32_t instrument, int32_t midi) {
  switch (instrument) {
    case KB_TUNER_INSTRUMENT_GUITAR:
      return midi <= kGuitarLowMaxMidi ? kWideCents : kTightCents;
    case KB_TUNER_INSTRUMENT_BASS:
      if (midi <= kBassLowMaxMidi) return kWideCents;
      return midi <= kBassMidMaxMidi ? kMidCents : kTightCents;
    case KB_TUNER_INSTRUMENT_UKULELE:
      return midi < kUkuleleHighMidi ? kUkuleleLowCents : kMidCents;
    default:
      return kMidCents;
  }
}

// In tune is [-7, +7] after rounding, the same span as the display's ±7 check.
int32_t StatusForError(double error_cents) {
  const auto rounded = static_cast<int32_t>(std::lround(error_cents));
  if (rounded < -kStatusInTuneCents) return KB_TUNING_TOO_LOW;
  if (rounded > kStatusInTuneCents) return KB_TUNING_TOO_HIGH;
  return KB_TUNING_IN_TUNE;
}

double MidiForHz(double hz, double a4_hz) {
  return kMidiA4 + kSemitonesPerOctave * std::log2(hz / a4_hz);
}

double HzForMidi(double midi, double a4_hz) {
  return a4_hz * std::exp2((midi - kMidiA4) / kSemitonesPerOctave);
}

}  // namespace kitbag::tuning_rules
