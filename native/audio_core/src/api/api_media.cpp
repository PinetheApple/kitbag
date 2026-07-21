// Decoder and mixer entry points: playback-side ABI, split from api.cpp so no
// one translation unit owns the whole surface.
#include "kitbag_api.h"

#include "api/api_engine.h"

using kitbag::ToEngine;

extern "C" {

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

void kb_mixer_set_track_data(
    kb_engine* engine,
    int32_t track,
    const float* pcm,
    int64_t num_frames,
    int32_t channels,
    int32_t sample_rate
) {
  if (engine == nullptr || pcm == nullptr) return;
  ToEngine(engine)->mixer().SetTrackData(
      track,
      pcm,
      static_cast<uint64_t>(num_frames),
      static_cast<uint32_t>(channels),
      static_cast<uint32_t>(sample_rate)
  );
}

void kb_mixer_set_gain(kb_engine* engine, int32_t track, float gain) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetGain(track, gain);
}

float kb_mixer_gain(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0.0f : ToEngine(engine)->mixer().gain(track);
}

void kb_mixer_set_mute(kb_engine* engine, int32_t track, int32_t muted) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetMute(track, muted != 0);
}

int32_t kb_mixer_muted(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->mixer().muted(track) ? 1 : 0);
}

void kb_mixer_set_solo(kb_engine* engine, int32_t track, int32_t soloed) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetSolo(track, soloed != 0);
}

int32_t kb_mixer_soloed(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->mixer().soloed(track) ? 1 : 0);
}

void kb_mixer_play(kb_engine* engine) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Play();
}

void kb_mixer_stop(kb_engine* engine) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Stop();
}

void kb_mixer_pause(kb_engine* engine) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Pause();
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
                                 ToEngine(engine)->mixer().track_frames(track)
                             );
}
}  // extern "C"
