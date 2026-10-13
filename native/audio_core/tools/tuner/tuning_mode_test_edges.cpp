// Edges of the detector and the gates around it, in chromatic and manual mode
// where no string list hides a wrong pitch.
#include "tuner/tuning_mode.h"
#include "tuning_mode_test_support.h"

namespace tuning_test {
namespace {

bool NoNote(const kb_tuner_state& s) {
  return s.can_hear_note == 0;
}

// A tone outside the analysis range must not read as a note inside it.
void ExpectSilentAbove(const char* mode, double hz) {
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 2.0, hz);
  Expect(HoldsFrom(log, 0, NoNote), log, "T19 %s %.0f Hz -> no note", mode, hz);
}

void AboveRange() {
  for (const double hz : {6000.0, 12000.0}) {
    BeginGuitar();
    kb_tuner_set_chromatic(g_engine);
    ExpectSilentAbove("chromatic", hz);
    BeginManual(kStringE4);
    ExpectSilentAbove("manual E4", hz);
  }
}

bool OnNote(const kb_tuner_state& s, int32_t midi, double cents) {
  return s.can_hear_note == 1 && NoString(s) && s.target_midi == midi &&
         std::fabs(s.tuning_error_cents - cents) <= 1.0;
}

// The default chromatic range's ends: B0 and C7, each detuned so a reading
// echoed from the target fails. Single-lag interpolation misses C7 by cents.
void ChromaticEdges() {
  const struct {
    int32_t midi;
    double cents;
  } notes[] = {{23, 7.0}, {96, -7.0}, {85, 13.0}};
  for (const auto& n : notes) {
    BeginGuitar();
    kb_tuner_set_chromatic(g_engine);
    Log log;
    ToneOsc osc;
    FeedTone(&log, &osc, 1.0, Detune(MidiHz(n.midi), n.cents));
    const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [&](auto& s) {
      return OnNote(s, n.midi, n.cents);
    });
    Expect(
        ok,
        log,
        "chromatic MIDI %d %+.0fc reads within 1c",
        n.midi,
        n.cents
    );
  }
}

// Outside the range nothing is reported: A0 and D7 by default, then 1 kHz
// after kb_tuner_set_band narrows it to 60-900 Hz, while 440 Hz still reads.
void ChromaticOutOfBand() {
  for (const int32_t midi : {21, 98}) {
    BeginGuitar();
    kb_tuner_set_chromatic(g_engine);
    ExpectSilentAbove("chromatic out of band, MIDI", MidiHz(midi));
  }
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
  kb_tuner_set_band(g_engine, 60.0, 900.0);
  ExpectSilentAbove("chromatic band 60-900", 1000.0);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, MidiHz(69));
  const bool reads = HoldsFrom(log, IndexAt(log, 0.6), [](auto& s) {
    return OnNote(s, 69, 0.0);
  });
  Expect(reads, log, "chromatic band 60-900: 440 Hz still reads");
  kb_tuner_set_band(
      g_engine,
      kitbag::TuningMode::kChromaticLowHz,
      kitbag::TuningMode::kChromaticHighHz
  );
}

// Interpolating at one lag misses B6 +37 c by 0.44 c, inside every ±1 c check;
// refining at a multiple of the period gets 0.006 c. This pins the latter.
void Precision() {
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
  Log log;
  ToneOsc osc;
  FeedTone(&log, &osc, 1.0, Detune(MidiHz(95), 37.0));
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [](auto& s) {
    return s.target_midi == 95 && std::fabs(s.tuning_error_cents - 37.0) <= 0.1;
  });
  Expect(ok, log, "chromatic B6 +37c reads within 0.1c");
}

// -30 dBFS noise in chromatic mode: every frame carries some pitch, so only
// the clarity gate keeps it silent.
void ChromaticNoise() {
  constexpr double kMinus30DbfsRms = 0.03162277660168379;
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
  Log log;
  Noise noise(kMinus30DbfsRms);
  Feed(&log, 5.0, [&] { return noise.Next(); });
  Expect(HoldsFrom(log, 0, NoNote), log, "chromatic -30 dBFS noise -> no note");
}

// E4 under noise 14 dB down reads clarity ~0.96: above the 0.8 gate, so it
// must still be heard, and within 2 c.
void NoisyTone() {
  BeginGuitar();
  kb_tuner_set_chromatic(g_engine);
  const double hz = Detune(GuitarHz(kStringE4), 6.0);
  ToneOsc osc;
  Noise noise(ToneOsc::UnitRms(hz) * std::pow(10.0, -14.0 / 20.0));
  Log log;
  Feed(&log, 2.0, [&] { return osc.Next(hz) + noise.Next(); });
  const bool ok = HoldsFrom(log, IndexAt(log, 0.6), [](auto& s) {
    return s.can_hear_note == 1 && s.target_midi == 64 &&
           std::fabs(s.tuning_error_cents - 6.0) <= 2.0;
  });
  Expect(ok, log, "chromatic E4 +6c, noise 14 dB down -> heard within 2c");
}

}  // namespace

void RunEdgeTests() {
  AboveRange();
  ChromaticEdges();
  ChromaticOutOfBand();
  ChromaticNoise();
  NoisyTone();
  Precision();
}

}  // namespace tuning_test
