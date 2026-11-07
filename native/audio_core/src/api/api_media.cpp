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

kb_result
kb_mixer_load_track(kb_engine* engine, int32_t track, const char* path) {
  if (engine == nullptr || path == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Engine* e = ToEngine(engine);
  using Result = kitbag::Mixer::LoadResult;
  switch (
      e->mixer().LoadTrack(track, path, e->frame_clock(), e->is_running())) {
    case Result::kOk:
      return KB_OK;
    case Result::kInvalid:
      return KB_ERROR_INVALID_ARGUMENT;
    case Result::kPrimeFailed:
      return KB_ERROR_INTERNAL;
  }
  return KB_ERROR_INTERNAL;
}

void kb_mixer_unload_track(kb_engine* engine, int32_t track) {
  if (engine == nullptr) return;
  kitbag::Engine* e = ToEngine(engine);
  e->mixer().UnloadTrack(track, e->frame_clock(), e->is_running());
}

int32_t kb_mixer_track_ready(const kb_engine* engine, int32_t track) {
  return engine == nullptr
             ? 0
             : (ToEngine(engine)->mixer().track_ready(track) ? 1 : 0);
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

void kb_mixer_set_master_gain(kb_engine* engine, float gain) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().SetMasterGain(gain);
}

float kb_mixer_master_gain(const kb_engine* engine) {
  return engine == nullptr ? 0.0f : ToEngine(engine)->mixer().master_gain();
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
  ToEngine(engine)->SetMixerIntent(true);
  ToEngine(engine)->mixer().Play();
}

kb_result kb_mixer_play_at(kb_engine* engine, uint64_t start_frame) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Engine* e = ToEngine(engine);
  const bool had_intent = e->mixer_intent();
  e->SetMixerIntent(true);
  if (e->mixer().PlayAt(start_frame)) return KB_OK;
  e->SetMixerIntent(had_intent);
  return KB_ERROR_BUSY;
}

void kb_mixer_stop(kb_engine* engine) {
  if (engine == nullptr) return;
  kitbag::Engine* e = ToEngine(engine);
  e->mixer().Stop(e->frame_clock(), e->is_running());
  e->SetMixerIntent(false);
}

void kb_mixer_pause(kb_engine* engine) {
  if (engine == nullptr) return;
  ToEngine(engine)->mixer().Pause();
  ToEngine(engine)->SetMixerIntent(false);
}

int32_t kb_mixer_is_playing(const kb_engine* engine) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->mixer().is_playing() ? 1 : 0);
}

void kb_mixer_seek(kb_engine* engine, int64_t frame) {
  if (engine == nullptr) return;
  kitbag::Engine* e = ToEngine(engine);
  e->mixer()
      .Seek(static_cast<uint64_t>(frame), e->frame_clock(), e->is_running());
}

kb_result
kb_mixer_set_loop(kb_engine* engine, int64_t start_frame, int64_t end_frame) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Engine* e = ToEngine(engine);
  using Result = kitbag::Mixer::LoopResult;
  switch (
      e->mixer()
          .SetLoop(start_frame, end_frame, e->frame_clock(), e->is_running())) {
    case Result::kOk:
      return KB_OK;
    case Result::kInvalid:
      return KB_ERROR_INVALID_ARGUMENT;
    case Result::kRebuildFailed:
      return KB_ERROR_INTERNAL;
  }
  return KB_ERROR_INTERNAL;
}

kb_result kb_mixer_clear_loop(kb_engine* engine) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Engine* e = ToEngine(engine);
  const bool ok = e->mixer().ClearLoop(e->frame_clock(), e->is_running());
  return ok ? KB_OK : KB_ERROR_INTERNAL;
}

namespace {

kb_result ToKbResult(kitbag::Mixer::StretchResult result) {
  switch (result) {
    case kitbag::Mixer::StretchResult::kOk:
      return KB_OK;
    case kitbag::Mixer::StretchResult::kBusy:
      return KB_ERROR_BUSY;
    case kitbag::Mixer::StretchResult::kNoTrack:
      return KB_ERROR_INVALID_ARGUMENT;
    case kitbag::Mixer::StretchResult::kPrimeFailed:
      return KB_ERROR_INTERNAL;
  }
  return KB_ERROR_INTERNAL;
}

}  // namespace

// The range test is written to fail on NaN.
kb_result kb_mixer_set_rate(kb_engine* engine, float rate) {
  using kitbag::Mixer;
  if (engine == nullptr ||
      !(rate >= Mixer::kMinRate && rate <= Mixer::kMaxRate)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* e = ToEngine(engine);
  return ToKbResult(
      e->mixer().SetRate(rate, e->frame_clock(), e->is_running())
  );
}

float kb_mixer_rate(const kb_engine* engine) {
  return engine == nullptr ? 0.0f : ToEngine(engine)->mixer().rate();
}

kb_result
kb_mixer_set_track_pitch(kb_engine* engine, int32_t track, int32_t semitones) {
  using kitbag::Mixer;
  if (engine == nullptr || semitones < Mixer::kMinPitchSemitones ||
      semitones > Mixer::kMaxPitchSemitones) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* e = ToEngine(engine);
  if (!e->mixer().track_ready(track)) return KB_ERROR_INVALID_ARGUMENT;
  return ToKbResult(e->mixer().SetTrackPitch(
      track,
      static_cast<float>(semitones),
      e->frame_clock(),
      e->is_running()
  ));
}

int32_t kb_mixer_track_pitch(const kb_engine* engine, int32_t track) {
  return engine == nullptr ? 0 : ToEngine(engine)->mixer().track_pitch(track);
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

kb_result kb_player_load(kb_engine* engine, const char* path) {
  if (engine == nullptr || path == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Engine* e = ToEngine(engine);
  const bool ok = e->player().Load(path, e->frame_clock(), e->is_running());
  return ok ? KB_OK : KB_ERROR_INVALID_ARGUMENT;
}

void kb_player_unload(kb_engine* engine) {
  if (engine == nullptr) return;
  kitbag::Engine* e = ToEngine(engine);
  e->player().Unload(e->frame_clock(), e->is_running());
}

void kb_player_play(kb_engine* engine) {
  if (engine != nullptr) ToEngine(engine)->player().Play();
}

void kb_player_pause(kb_engine* engine) {
  if (engine != nullptr) ToEngine(engine)->player().Pause();
}

void kb_player_seek(kb_engine* engine, int64_t frame) {
  if (engine == nullptr) return;
  kitbag::Engine* e = ToEngine(engine);
  e->player()
      .Seek(static_cast<uint64_t>(frame), e->frame_clock(), e->is_running());
}

int64_t kb_player_position(const kb_engine* engine) {
  return engine == nullptr
             ? 0
             : static_cast<int64_t>(ToEngine(engine)->player().position());
}

int64_t kb_player_frames(const kb_engine* engine) {
  return engine == nullptr
             ? 0
             : static_cast<int64_t>(ToEngine(engine)->player().frames());
}

int32_t kb_player_is_playing(const kb_engine* engine) {
  return engine == nullptr ? 0
                           : (ToEngine(engine)->player().is_playing() ? 1 : 0);
}
}  // extern "C"
