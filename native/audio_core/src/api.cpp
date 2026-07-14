#include "kitbag_api.h"

#include <cstdio>
#include <cstring>

#include "beat_tracker.h"
#include "decoder.h"
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

kb_result kb_decoder_open(kb_engine* engine, const char* path) {
  if (engine == nullptr || path == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return ToEngine(engine)->decoder().Open(path) ? KB_OK
                                                : KB_ERROR_INVALID_ARGUMENT;
}

void kb_decoder_close(kb_engine* engine) {
  if (engine != nullptr) {
    ToEngine(engine)->decoder().Close();
  }
}

double kb_decoder_duration(const kb_engine* engine) {
  return engine == nullptr ? 0.0
                           : ToEngine(engine)->decoder().info().duration_seconds;
}

uint32_t kb_decoder_sample_rate(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->decoder().info().sample_rate;
}

uint32_t kb_decoder_channels(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->decoder().info().channels;
}

kb_result kb_analyze_song(const char* path, float* bpm_out,
                          float* beat_times_buf, int32_t beat_times_cap,
                          int32_t* beat_count_out, const char* waveform_dir) {
  if (path == nullptr || bpm_out == nullptr || beat_times_buf == nullptr ||
      beat_count_out == nullptr) {
    return KB_ERROR_INVALID_ARGUMENT;
  }

  *bpm_out = 0.0f;
  *beat_count_out = 0;

  // Open and decode the file using a standalone decoder (no engine needed).
  kitbag::Decoder decoder;
  if (!decoder.Open(path)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }

  const auto info = decoder.info();

  // Read all PCM frames
  uint64_t total_frames = 0;
  auto pcm = decoder.DecodeAll(&total_frames);
  decoder.Close();

  if (pcm.empty() || total_frames == 0) {
    return KB_OK;
  }

  // Downmix to mono by averaging channels
  std::vector<float> mono(total_frames);
  for (uint64_t f = 0; f < total_frames; ++f) {
    float sum = 0.0f;
    for (uint32_t ch = 0; ch < info.channels; ++ch) {
      sum += pcm[f * info.channels + ch];
    }
    mono[f] = sum / static_cast<float>(info.channels);
  }

  // Run beat analysis
  kitbag::BeatTracker tracker;
  auto result =
      tracker.Analyze(mono.data(), static_cast<int>(total_frames),
                      static_cast<int>(info.sample_rate));

  *bpm_out = result.bpm;

  const int to_copy =
      std::min(static_cast<int>(result.beat_times.size()), beat_times_cap);
  for (int i = 0; i < to_copy; ++i) {
    beat_times_buf[i] = result.beat_times[i];
  }
  *beat_count_out = to_copy;

  // Generate waveform peaks sidecar if requested
  if (waveform_dir != nullptr && info.channels > 0) {
    auto peaks = kitbag::BeatTracker::ComputeWaveformPeaks(
        pcm.data(), static_cast<int>(total_frames),
        static_cast<int>(info.channels), 2000);

    if (!peaks.data.empty()) {
      // Build sidecar file path: <waveform_dir>/<basename>.kwav
      std::string kwav_path = waveform_dir;
      if (!kwav_path.empty() && kwav_path.back() != '/') {
        kwav_path += '/';
      }
      const char* basename = std::strrchr(path, '/');
      if (basename == nullptr) {
        basename = path;
      } else {
        ++basename;
      }
      kwav_path += basename;
      // Replace extension with .kwav
      const char* dot = std::strrchr(basename, '.');
      if (dot != nullptr) {
        kwav_path.resize(kwav_path.size() - (std::strlen(dot) - 4));
      }
      kwav_path += ".kwav";

      FILE* f = std::fopen(kwav_path.c_str(), "wb");
      if (f != nullptr) {
        // Format: magic "KWAV" (4), version(uint32), channels(uint32),
        // total_frames(int64), chunk_count(uint32), data(int16[])
        const uint32_t version = 1;
        const uint32_t channels_u32 =
            static_cast<uint32_t>(peaks.channels);
        const int64_t total = peaks.total_frames;
        const uint32_t chunks = static_cast<uint32_t>(peaks.chunk_count);
        std::fwrite("KWAV", 1, 4, f);
        std::fwrite(&version, sizeof(version), 1, f);
        std::fwrite(&channels_u32, sizeof(channels_u32), 1, f);
        std::fwrite(&total, sizeof(total), 1, f);
        std::fwrite(&chunks, sizeof(chunks), 1, f);
        std::fwrite(peaks.data.data(), sizeof(int16_t), peaks.data.size(),
                    f);
        std::fclose(f);
      }
    }
  }

  return KB_OK;
}

}  // extern "C"
