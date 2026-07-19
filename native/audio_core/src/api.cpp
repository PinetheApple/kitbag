#include "kitbag_api.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <memory>

#include "beat_tracker.h"
#include "decoder.h"
#include "engine.h"
#include "sidecar_path.h"

namespace {
constexpr const char* kVersion = "0.1.0";

kitbag::Engine* ToEngine(kb_engine* engine) {
  return reinterpret_cast<kitbag::Engine*>(engine);
}

const kitbag::Engine* ToEngine(const kb_engine* engine) {
  return reinterpret_cast<const kitbag::Engine*>(engine);
}

void WriteWaveformSidecar(const char* path, const char* waveform_dir,
                          const float* pcm, uint64_t total_frames,
                          uint32_t channels) {
  // Peak buckets across the whole file — the scrubber's horizontal resolution.
  constexpr int kWaveformTargetChunks = 2000;
  auto peaks = kitbag::BeatTracker::ComputeWaveformPeaks(
      pcm, static_cast<int>(total_frames), static_cast<int>(channels),
      kWaveformTargetChunks);
  if (peaks.data.empty()) {
    return;
  }

  const std::string kwav_path = kitbag::SidecarPath(waveform_dir, path);

  FILE* f = std::fopen(kwav_path.c_str(), "wb");
  if (f == nullptr) {
    return;
  }
  // Format: magic "KWAV" (4), version(uint32), channels(uint32),
  // total_frames(int64), chunk_count(uint32), data(int16[])
  const uint32_t version = 1;
  const auto channels_u32 = static_cast<uint32_t>(peaks.channels);
  const int64_t total = peaks.total_frames;
  const auto chunks = static_cast<uint32_t>(peaks.chunk_count);
  std::fwrite("KWAV", 1, 4, f);
  std::fwrite(&version, sizeof(version), 1, f);
  std::fwrite(&channels_u32, sizeof(channels_u32), 1, f);
  std::fwrite(&total, sizeof(total), 1, f);
  std::fwrite(&chunks, sizeof(chunks), 1, f);
  std::fwrite(peaks.data.data(), sizeof(int16_t), peaks.data.size(), f);
  std::fclose(f);
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

kb_result kb_metronome_set_grid(kb_engine* engine, const double* beat_times_sec,
                                int32_t count, uint64_t anchor_frame) {
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
  target->metronome().SetGrid(std::move(grid), target->frames_rendered(),
                              target->is_running());
  return KB_OK;
}

void kb_metronome_clear_grid(kb_engine* engine) {
  if (engine != nullptr) {
    kitbag::Engine* target = ToEngine(engine);
    target->metronome().ClearGrid(target->frames_rendered(),
                                  target->is_running());
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

void kb_metronome_set_ramp(kb_engine* engine, int32_t enabled, double start_bpm,
                           double end_bpm, int32_t bars) {
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
  return engine == nullptr
             ? 0.0
             : ToEngine(engine)->decoder().info().duration_seconds;
}

uint32_t kb_decoder_sample_rate(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->decoder().info().sample_rate;
}

uint32_t kb_decoder_channels(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->decoder().info().channels;
}

void kb_mixer_set_track_data(kb_engine* engine, int32_t track, const float* pcm,
                             int64_t num_frames, int32_t channels,
                             int32_t sample_rate) {
  if (engine == nullptr || pcm == nullptr) return;
  ToEngine(engine)->mixer().SetTrackData(
      track, pcm, static_cast<uint64_t>(num_frames),
      static_cast<uint32_t>(channels), static_cast<uint32_t>(sample_rate));
}

void kb_mixer_set_gain(kb_engine* engine, int32_t track, float gain) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetGain(track, gain);
}

float kb_mixer_gain(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0.0f : ToEngine(engine)->mixer().Gain(track);
}

void kb_mixer_set_mute(kb_engine* engine, int32_t track, int32_t muted) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetMute(track, muted != 0);
}

int32_t kb_mixer_muted(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->mixer().Muted(track) ? 1 : 0);
}

void kb_mixer_set_solo(kb_engine* engine, int32_t track, int32_t soloed) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetSolo(track, soloed != 0);
}

int32_t kb_mixer_soloed(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->mixer().Soloed(track) ? 1 : 0);
}

void kb_mixer_play(kb_engine* engine) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Play();
}

void kb_mixer_stop(kb_engine* engine) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Stop();
}

int32_t kb_mixer_is_playing(const kb_engine* engine) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->mixer().is_playing() ? 1 : 0);
}

void kb_mixer_seek(kb_engine* engine, int64_t frame) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Seek(static_cast<uint64_t>(frame));
}

int64_t kb_mixer_position(const kb_engine* engine) {
  return engine == nullptr
             ? 0
             : static_cast<int64_t>(ToEngine(engine)->mixer().position());
}

int32_t kb_mixer_active_track_count(const kb_engine* engine) {
  return engine == nullptr ? 0 : ToEngine(engine)->mixer().active_track_count();
}

int64_t kb_mixer_track_frames(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0
                           : static_cast<int64_t>(
                                 ToEngine(engine)->mixer().track_frames(track));
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

  kitbag::Decoder decoder;
  if (!decoder.Open(path)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }

  const auto info = decoder.info();

  uint64_t total_frames = 0;
  auto pcm = decoder.DecodeAll(&total_frames);
  decoder.Close();

  if (pcm.empty() || total_frames == 0) {
    return KB_OK;
  }

  std::vector<float> mono(total_frames);
  for (uint64_t f = 0; f < total_frames; ++f) {
    float sum = 0.0f;
    for (uint32_t ch = 0; ch < info.channels; ++ch) {
      sum += pcm[f * info.channels + ch];
    }
    mono[f] = sum / static_cast<float>(info.channels);
  }

  kitbag::BeatTracker tracker;
  auto result = tracker.Analyze(mono.data(), static_cast<int>(total_frames),
                                static_cast<int>(info.sample_rate));

  *bpm_out = result.bpm;

  const int to_copy =
      std::min(static_cast<int>(result.beat_times.size()), beat_times_cap);
  for (int i = 0; i < to_copy; ++i) {
    beat_times_buf[i] = result.beat_times[i];
  }
  *beat_count_out = to_copy;

  if (waveform_dir != nullptr && info.channels > 0) {
    WriteWaveformSidecar(path, waveform_dir, pcm.data(), total_frames,
                         info.channels);
  }

  return KB_OK;
}

}  // extern "C"
