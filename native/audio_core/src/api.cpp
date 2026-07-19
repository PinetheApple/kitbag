#include "kitbag_api.h"

#include <cmath>
#include <memory>

#include "api_engine.h"

namespace {
constexpr const char* kVersion = "0.1.0";
}  // namespace

using kitbag::ToEngine;

extern "C" {

const char* kb_version(void) {
  return kVersion;
}

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

void kb_engine_destroy(kb_engine* engine) {
  delete ToEngine(engine);
}

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

void kb_engine_set_test_tone(
    kb_engine* engine,
    int32_t enabled,
    float frequency_hz
) {
  if (engine != nullptr) {
    ToEngine(engine)->SetTestTone(enabled != 0, frequency_hz);
  }
}

void kb_metronome_start(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().Start();
  }
}

void kb_metronome_start_at(kb_engine* engine, uint64_t start_frame) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().StartAt(start_frame);
  }
}

void kb_metronome_stop(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().Stop();
  }
}

kb_result kb_metronome_set_grid(
    kb_engine* engine,
    const double* beat_times_sec,
    int32_t count,
    uint64_t anchor_frame
) {
  if (engine == nullptr || beat_times_sec == nullptr || count <= 0 ||
      count > KB_MAX_GRID_BEATS) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  // Reject a malformed grid here rather than letting the callback meet it: the
  // cursor is a monotonic walk that cannot recover from one. NaN needs its own
  // check — every comparison against it is false, so it slips through the
  // ascending test and then violates lower_bound's ordering precondition.
  for (int32_t i = 0; i < count; ++i) {
    if (!std::isfinite(beat_times_sec[i])) {
      return KB_ERROR_INVALID_ARGUMENT;
    }
    if (i > 0 && beat_times_sec[i] <= beat_times_sec[i - 1]) {
      return KB_ERROR_INVALID_ARGUMENT;
    }
  }

  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec.assign(beat_times_sec, beat_times_sec + count);
  grid->anchor_frame = anchor_frame;

  kitbag::Engine* target = ToEngine(engine);
  target->metronome().SetGrid(
      std::move(grid),
      target->frames_rendered(),
      target->is_running()
  );
  return KB_OK;
}

void kb_metronome_clear_grid(kb_engine* engine) {
  if (engine != nullptr) {
    kitbag::Engine* target = ToEngine(engine);
    target->metronome().ClearGrid(
        target->frames_rendered(),
        target->is_running()
    );
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

void kb_metronome_set_accent(
    kb_engine* engine,
    int32_t beat_index,
    int32_t accent
) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetAccent(
        beat_index,
        static_cast<kitbag::Accent>(accent)
    );
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

void kb_metronome_set_volume(kb_engine* engine, double volume) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetVolume(volume);
  }
}

void kb_metronome_set_latency_offset(kb_engine* engine, double latency_ms) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetLatencyOffset(latency_ms);
  }
}

void kb_metronome_set_ramp(
    kb_engine* engine,
    int32_t enabled,
    double start_bpm,
    double end_bpm,
    int32_t bars
) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetRamp(
        enabled != 0,
        start_bpm,
        end_bpm,
        bars
    );
  }
}

void kb_metronome_set_bar_mute(
    kb_engine* engine,
    int32_t enabled,
    int32_t play_bars,
    int32_t mute_bars
) {
  if (engine != nullptr) {
    ToEngine(engine)->metronome().SetBarMute(
        enabled != 0,
        play_bars,
        mute_bars
    );
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
  return engine == nullptr ? -1
                           : ToEngine(engine)->metronome().current_poly_beat();
}

double kb_metronome_bar_phase(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->metronome().bar_phase();
}

double kb_metronome_current_bpm(const kb_engine* engine) {
  return engine == nullptr ? 0.0 : ToEngine(engine)->metronome().current_bpm();
}

int32_t kb_metronome_bar_muted(const kb_engine* engine) {
  return engine != nullptr && ToEngine(engine)->metronome().bar_muted() ? 1 : 0;
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

uint64_t kb_tuner_snapshot(const kb_engine* engine) {
  return engine == nullptr
             ? kitbag::Tuner::PackSnapshot(kitbag::PitchAnalyzer::Reading{})
             : ToEngine(engine)->tuner().snapshot();
}

}  // extern "C"
