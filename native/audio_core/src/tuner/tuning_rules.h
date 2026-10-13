#ifndef KITBAG_TUNER_TUNING_RULES_H
#define KITBAG_TUNER_TUNING_RULES_H

// The tuning mode's fixed parameters and the pure rules built on them. P-ids
// are rows of docs/tuner-functional-spec.md §4.2.
#include <cstdint>

namespace kitbag::tuning_rules {

constexpr double kCentsPerSemitone = 100.0;
constexpr double kFrameSeconds = 0.090;           // P1, rounded to a power of 2
constexpr double kMicLevelSeconds = 3.0;          // P3
constexpr double kBlendLimitCents = 70.0;         // P8
constexpr double kBlendNewWeight = 0.25;          // P8
constexpr int kMedianLength = 7;                  // P9
constexpr int kMaxConfidence = 17;                // P10
constexpr int kOtherStringCost = 2;               // P10: another string named
constexpr int kStrayPitchCost = 1;                // P10: any other pitch
constexpr double kAutoStringCents = 350.0;        // P11
constexpr double kTimeToFullyInTune = 0.74;       // P16
constexpr double kNoSoundSeconds = 20.0;          // P19
constexpr double kWrongStringMinRms = 0.0004;     // P20
constexpr double kWrongStringStableSemis = 2.0;   // P21
constexpr double kWrongStringMinSemis = 3.5;      // P22
constexpr double kWrongStringDwellSeconds = 1.0;  // P23
constexpr double kReleaseHoldSeconds = 1.2;       // P27
// P7: the range a string tuning searches, around its lowest and highest notes.
constexpr int32_t kRangeBelowLowest = 14;
constexpr int32_t kRangeAboveHighest = 7;

// Frames below this RMS, or less periodic than this NSDF clarity, carry no
// pitch. Chosen for the synthetic harness, not measured on a device.
constexpr double kMinRms = 0.0001;
constexpr double kMinClarity = 0.8;

// P12-P15: half-width of the in-tune window, cents, for a string's MIDI note.
double InTuneWindowCents(int32_t instrument, int32_t midi);

// P18: kb_tuning_status for an error, compared after rounding to whole cents.
int32_t StatusForError(double error_cents);

double MidiForHz(double hz, double a4_hz);
double HzForMidi(double midi, double a4_hz);

}  // namespace kitbag::tuning_rules

#endif  // KITBAG_TUNER_TUNING_RULES_H
