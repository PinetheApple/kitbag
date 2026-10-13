// abi_verify's tuner half: kitbag_tuner_api.h through the shared library.
#include "abi_verify_tuner.h"

#include "check.h"

namespace {

using kitbag_test::Check;

bool IsRestState(const kb_tuner_state& s) {
  return s.can_hear_note == 0 && s.current_string == KB_TUNER_NO_STRING &&
         s.possible_wrong_string == KB_TUNER_NO_STRING &&
         s.tuning_status == KB_TUNING_NOT_MEASURED && s.in_tune_ratio == 0.0 &&
         s.target_midi == KB_TUNER_NO_NOTE;
}

struct TuningCase {
  kb_engine* engine;
  int32_t instrument;
  const int32_t* midis;
  int32_t count;
  kb_result want;
  const char* name;
};

// Tuning-mode configuration is validated at the boundary; a rejected call
// must leave the previous tuning in force (target 5 needs six strings).
void TestTunerSetTuning(kb_engine* engine) {
  const int32_t guitar[] = {40, 45, 50, 55, 59, 64};
  const int32_t bad_note[] = {40, 128};
  const int32_t thirteen[13] = {};
  constexpr int32_t kGuitar = KB_TUNER_INSTRUMENT_GUITAR;
  constexpr kb_result kBad = KB_ERROR_INVALID_ARGUMENT;
  const TuningCase cases[] = {
      {engine, kGuitar, guitar, 6, KB_OK, "tuning: guitar accepted"},
      {engine, kGuitar, nullptr, 6, kBad, "tuning: null list"},
      {engine, kGuitar, guitar, 0, kBad, "tuning: empty list"},
      {engine, kGuitar, thirteen, 13, kBad, "tuning: above max strings"},
      {engine, kGuitar, bad_note, 2, kBad, "tuning: MIDI note above 127"},
      {engine, 4, guitar, 6, kBad, "tuning: unknown instrument"},
      {nullptr, kGuitar, guitar, 6, kBad, "tuning: null engine"},
  };
  for (const TuningCase& c : cases) {
    const kb_result got =
        kb_tuner_set_tuning(c.engine, c.instrument, c.midis, c.count);
    Check(got == c.want, c.name);
  }
  Check(
      kb_tuner_set_target_string(engine, 5) == KB_OK,
      "tuning: a rejected call kept the six strings"
  );
}

void TestTunerTargetString(kb_engine* engine) {
  const int32_t bass[] = {28, 33, 38, 43};
  kb_tuner_set_tuning(engine, KB_TUNER_INSTRUMENT_BASS, bass, 4);
  const struct {
    kb_engine* engine;
    int32_t index;
    kb_result want;
    const char* name;
  } cases[] = {
      {engine, 3, KB_OK, "target: last string accepted"},
      {engine, 4, KB_ERROR_INVALID_ARGUMENT, "target: past the tuning"},
      {engine, -2, KB_ERROR_INVALID_ARGUMENT, "target: negative index"},
      {engine, KB_TUNER_AUTO_STRING, KB_OK, "target: auto accepted"},
      {nullptr, 0, KB_ERROR_INVALID_ARGUMENT, "target: null engine"},
  };
  for (const auto& c : cases) {
    Check(kb_tuner_set_target_string(c.engine, c.index) == c.want, c.name);
  }
}

void TestTunerState(kb_engine* engine) {
  kb_tuner_state state{.current_string = 7};
  kb_tuner_read_state(engine, &state);
  Check(IsRestState(state), "state: a fresh engine reads the rest state");
  state = {.current_string = 7};
  kb_tuner_read_state(nullptr, &state);
  Check(IsRestState(state), "state: a null engine reads the rest state");
  kb_tuner_read_state(engine, nullptr);  // a null out is a no-op, not a crash
}

// Offline drive refuses bad input; its behaviour is pinned in tuner_verify.
void TestTunerOffline(kb_engine* engine) {
  const struct {
    kb_engine* engine;
    uint32_t rate;
    kb_result want;
    const char* name;
  } cases[] = {
      {engine, 48000, KB_OK, "offline: init at 48 kHz"},
      {engine, 0, KB_ERROR_INVALID_ARGUMENT, "offline: zero rate"},
      {nullptr, 48000, KB_ERROR_INVALID_ARGUMENT, "offline: null engine"},
  };
  for (const auto& c : cases) {
    Check(kb_tuner_offline_init(c.engine, c.rate) == c.want, c.name);
  }
  const float silence[64] = {};
  kb_tuner_offline_process(nullptr, silence, 64);
  kb_tuner_offline_process(engine, nullptr, 64);
  kb_tuner_offline_process(engine, silence, 64);
}

// With the mic off a setter applies at once, so it is never KB_ERROR_BUSY.
void TestTunerSetters(kb_engine* engine) {
  constexpr kb_result kBad = KB_ERROR_INVALID_ARGUMENT;
  const struct {
    kb_result got;
    kb_result want;
    const char* name;
  } cases[] = {
      {kb_tuner_set_a4(engine, 432.0), KB_OK, "a4: accepted"},
      {kb_tuner_set_a4(nullptr, 432.0), kBad, "a4: null engine"},
      {kb_tuner_set_band(engine, 60.0, 900.0), KB_OK, "band: accepted"},
      {kb_tuner_set_band(engine, 900.0, 60.0), kBad, "band: inverted"},
      {kb_tuner_set_band(engine, 0.0, 900.0), kBad, "band: zero low"},
      {kb_tuner_set_band(nullptr, 60.0, 900.0), kBad, "band: null engine"},
      {kb_tuner_set_chromatic(engine), KB_OK, "chromatic: accepted"},
      {kb_tuner_set_chromatic(nullptr), kBad, "chromatic: null engine"},
      {kb_tuner_reset_note_presence(engine, -1.0), KB_OK, "reset: accepted"},
      {kb_tuner_reset_note_presence(nullptr, 500.0), kBad, "reset: null"},
  };
  for (const auto& c : cases) Check(c.got == c.want, c.name);
  kb_tuner_state state{.current_string = 7};
  kb_tuner_read_state(engine, &state);
  Check(IsRestState(state), "chromatic: switching drops the note");
  kb_tuner_set_a4(engine, 440.0);
}

}  // namespace

void RunTunerAbiTests(kb_engine* engine) {
  TestTunerSetTuning(engine);
  TestTunerTargetString(engine);
  TestTunerState(engine);
  TestTunerOffline(engine);
  TestTunerSetters(engine);
}
