#include "kitbag_api.h"

#include "engine.h"

namespace {
constexpr const char* kVersion = "0.1.0";

kitbag::Engine* ToEngine(kb_engine* engine) {
  return reinterpret_cast<kitbag::Engine*>(engine);
}

const kitbag::Engine* ToEngine(const kb_engine* engine) {
  return reinterpret_cast<const kitbag::Engine*>(engine);
}
}  // namespace

extern "C" {

const char* kb_version(void) { return kVersion; }

kb_result kb_engine_create(kb_engine** out_engine) {
  if (out_engine == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  auto* engine = new kitbag::Engine();
  if (!engine->Init()) {
    delete engine;
    *out_engine = nullptr;
    return KB_ERROR_DEVICE_INIT_FAILED;
  }
  *out_engine = reinterpret_cast<kb_engine*>(engine);
  return KB_OK;
}

void kb_engine_destroy(kb_engine* engine) { delete ToEngine(engine); }

kb_result kb_engine_start(kb_engine* engine) {
  if (engine == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return ToEngine(engine)->Start() ? KB_OK : KB_ERROR_DEVICE_START_FAILED;
}

void kb_engine_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->Stop();
  }
}

uint32_t kb_engine_sample_rate(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->sample_rate();
}

uint64_t kb_engine_frames_rendered(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->frames_rendered();
}

void kb_engine_set_test_tone(kb_engine* engine, int32_t enabled,
                             float frequency_hz) {
  if (engine != nullptr) {
    ToEngine(engine)->SetTestTone(enabled != 0, frequency_hz);
  }
}

void kb_metronome_start(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().Start();
  }
}

void kb_metronome_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().Stop();
  }
}

void kb_metronome_set_tempo(kb_engine* engine, double bpm) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetTempo(bpm);
  }
}

void kb_metronome_set_beats(kb_engine* engine, int32_t beats_per_bar) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetBeatsPerBar(beats_per_bar);
  }
}

void kb_metronome_set_subdivision(kb_engine* engine, int32_t subdivision) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetSubdivision(subdivision);
  }
}

void kb_metronome_set_accent(kb_engine* engine, int32_t beat_index,
                             int32_t accent) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetAccent(
        beat_index, static_cast<kitbag::Accent>(accent));
  }
}

void kb_metronome_set_poly(kb_engine* engine, int32_t enabled, int32_t beats) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetPolyrhythm(enabled != 0, beats);
  }
}

void kb_metronome_set_sound(kb_engine* engine, int32_t sound_index) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetSound(sound_index);
  }
}

void kb_metronome_set_ramp(kb_engine* engine, int32_t enabled,
                           double start_bpm, double end_bpm, int32_t bars) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetRamp(enabled != 0, start_bpm, end_bpm,
                                          bars);
  }
}

void kb_metronome_set_bar_mute(kb_engine* engine, int32_t enabled,
                               int32_t play_bars, int32_t mute_bars) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetBarMute(enabled != 0, play_bars,
                                             mute_bars);
  }
}

int32_t kb_metronome_is_running(const kb_engine* engine) {
  return engine != nullptr && ToEngine(engine)->metronome().is_running() ? 1
                                                                         : 0;
}

int32_t kb_metronome_current_beat(const kb_engine* engine) {
  return engine == nullptr ? -1 : ToEngine(engine)->metronome().current_beat();
}

int32_t kb_metronome_current_poly_beat(const kb_engine* engine) {
  return engine == nullptr
             ? -1
             : ToEngine(engine)->metronome().current_poly_beat();
}

double kb_metronome_bar_phase(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->metronome().bar_phase();
}

double kb_metronome_current_bpm(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->metronome().current_bpm();
}

int32_t kb_metronome_bar_muted(const kb_engine* engine) {
  return engine != nullptr && ToEngine(engine)->metronome().bar_muted() ? 1
                                                                        : 0;
}

kb_result kb_tuner_start(kb_engine* engine) {
  if (engine == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return ToEngine(engine)->tuner().Start() ? KB_OK
                                           : KB_ERROR_DEVICE_INIT_FAILED;
}

void kb_tuner_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->tuner().Stop();
  }
}

int32_t kb_tuner_is_running(const kb_engine* engine) {
  return engine != nullptr && ToEngine(engine)->tuner().is_running() ? 1 : 0;
}

void kb_tuner_set_a4(kb_engine* engine, double a4_hz) {
  if (engine != nullptr) {
    ToEngine(engine)->tuner().SetA4(a4_hz);
  }
}

void kb_tuner_set_band(kb_engine* engine, double low_hz, double high_hz) {
  if (engine != nullptr) {
    ToEngine(engine)->tuner().SetBand(low_hz, high_hz);
  }
}

double kb_tuner_pitch_hz(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->tuner().pitch_hz();
}

double kb_tuner_cents(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->tuner().cents();
}

double kb_tuner_confidence(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->tuner().confidence();
}

int32_t kb_tuner_note_index(const kb_engine* engine) {
  return engine == nullptr ? -1 : ToEngine(engine)->tuner().note_index();
}

}  // extern "C"
