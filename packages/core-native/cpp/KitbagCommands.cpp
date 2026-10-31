#include "KitbagCommands.h"

#include <cassert>
#include <mutex>

#include "KitbagEngine.h"
#include "kitbag_api.h"

namespace kitbag {

namespace {
std::mutex commandMutex;

// The engine's command ring takes one producer, but commands come from both the
// JS module thread and the foreground service; the lock lives until the call returns.
struct LockedEngine {
  std::lock_guard<std::mutex> lock{commandMutex};
  kb_engine* engine = kitbagEngine();
  operator kb_engine*() const { return engine; }  // NOLINT(google-explicit-constructor)
};

LockedEngine commandEngine() {
  assert(kitbagEngine() != nullptr && "command dispatched before kitbagInstall()");
  return {};
}

int32_t flag(bool value) { return value ? 1 : 0; }

constexpr int32_t kNoOutputDeviceId = -1;
}  // namespace

int32_t commandStart() { return kb_engine_start(commandEngine()); }
void commandStop() { kb_engine_stop(commandEngine()); }
int32_t commandHold() { return kb_engine_hold(commandEngine()); }
void commandRelease() { kb_engine_release(commandEngine()); }
int32_t commandOutputDeviceId() {
  int32_t deviceId = kNoOutputDeviceId;
  if (kitbagEngine() == nullptr) return deviceId;
  kb_engine_output_device_id(commandEngine(), &deviceId);
  return deviceId;
}

// Play intent first, then the device: kitbag_engine_hold_api.h's ordering rule.
void commandMetronomeStart(double anchorFrame) {
  kb_metronome_start_at(commandEngine(), static_cast<uint64_t>(anchorFrame));
  commandStart();
}
void commandMetronomeStartNow() {
  kb_metronome_start(commandEngine());
  commandStart();
}
void commandMetronomeStop() { kb_metronome_stop(commandEngine()); }
void commandMetronomePause() { kb_metronome_pause(commandEngine()); }

void commandSetTempo(double bpm) { kb_metronome_set_tempo(commandEngine(), bpm); }

int32_t commandSetGrid(const double* beatTimesSec, int32_t count, double anchorFrame) {
  return kb_metronome_set_grid(commandEngine(), beatTimesSec, count,
                               static_cast<uint64_t>(anchorFrame));
}

void commandClearGrid() { kb_metronome_clear_grid(commandEngine()); }
void commandFollowMixer(bool enabled) {
  kb_metronome_follow_mixer(commandEngine(), flag(enabled));
}

void commandSetBeats(int32_t beatsPerBar, int32_t denominator) {
  kb_metronome_set_beats(commandEngine(), beatsPerBar, denominator);
}
void commandSetSubdivision(int32_t subdivision) {
  kb_metronome_set_subdivision(commandEngine(), subdivision);
}
void commandSetAccent(int32_t beatIndex, int32_t accent) {
  kb_metronome_set_accent(commandEngine(), beatIndex, accent);
}
void commandSetPoly(bool enabled, int32_t beats) {
  kb_metronome_set_poly(commandEngine(), flag(enabled), beats);
}
void commandSetPolyAccent(int32_t beatIndex, int32_t accent) {
  kb_metronome_set_poly_accent(commandEngine(), beatIndex, accent);
}
void commandSetPolyAgainst(int32_t mainBeats) {
  kb_metronome_set_poly_against(commandEngine(), mainBeats);
}
void commandSetSounds(int32_t normalSound, int32_t accentSound) {
  kb_metronome_set_sounds(commandEngine(), normalSound, accentSound);
}
void commandPreviewSound(int32_t sound, bool accented) {
  kb_metronome_preview_sound(commandEngine(), sound, flag(accented));
}
void commandSetCountIn(int32_t bars, bool distinct, int32_t sound) {
  kb_metronome_set_count_in(commandEngine(), bars, flag(distinct), sound);
}
void commandSetVolume(double volume) {
  kb_metronome_set_volume(commandEngine(), volume);
}
void commandSetLatencyOffset(double latencyMs) {
  kb_metronome_set_latency_offset(commandEngine(), latencyMs);
}

void commandSetRamp(
    bool enabled,
    double startBpm,
    double targetBpm,
    double stepBpm,
    double interval,
    int32_t unit,
    bool loop) {
  kb_metronome_set_ramp(commandEngine(), flag(enabled), startBpm, targetBpm,
                        stepBpm, interval, unit, flag(loop));
}
void commandSetBarMute(bool enabled, int32_t playBars, int32_t muteBars) {
  kb_metronome_set_bar_mute(commandEngine(), flag(enabled), playBars, muteBars);
}

int32_t commandLoadTrack(int32_t track, const char* path) {
  return kb_mixer_load_track(commandEngine(), track, path);
}
void commandUnloadTrack(int32_t track) { kb_mixer_unload_track(commandEngine(), track); }
void commandMixerSetGain(int32_t track, double gain) {
  kb_mixer_set_gain(commandEngine(), track, static_cast<float>(gain));
}
void commandMixerSetMute(int32_t track, bool muted) {
  kb_mixer_set_mute(commandEngine(), track, flag(muted));
}
void commandMixerSetSolo(int32_t track, bool soloed) {
  kb_mixer_set_solo(commandEngine(), track, flag(soloed));
}
void commandMixerSetMasterGain(double gain) {
  kb_mixer_set_master_gain(commandEngine(), static_cast<float>(gain));
}
double commandMixerMasterGain() { return kb_mixer_master_gain(commandEngine()); }
void commandMixerPlay() {
  kb_mixer_play(commandEngine());
  commandStart();
}
void commandMixerPause() { kb_mixer_pause(commandEngine()); }
void commandMixerStop() { kb_mixer_stop(commandEngine()); }
void commandMixerSeek(double frame) {
  kb_mixer_seek(commandEngine(), static_cast<int64_t>(frame));
}
int32_t commandMixerSetLoop(double startFrame, double endFrame) {
  return kb_mixer_set_loop(commandEngine(), static_cast<int64_t>(startFrame),
                           static_cast<int64_t>(endFrame));
}
int32_t commandMixerClearLoop() { return kb_mixer_clear_loop(commandEngine()); }

int32_t commandTunerStart() { return kb_tuner_start(commandEngine()); }
void commandTunerStop() { kb_tuner_stop(commandEngine()); }
int32_t commandTunerSetTuning(int32_t instrument, const int32_t* stringMidis, int32_t count) {
  return kb_tuner_set_tuning(commandEngine(), instrument, stringMidis, count);
}
int32_t commandTunerSetTargetString(int32_t stringIndex) {
  return kb_tuner_set_target_string(commandEngine(), stringIndex);
}
int32_t commandTunerSetChromatic() { return kb_tuner_set_chromatic(commandEngine()); }
int32_t commandTunerSetA4(double a4Hz) { return kb_tuner_set_a4(commandEngine(), a4Hz); }
int32_t commandTunerResetNotePresence(double pauseMs) {
  return kb_tuner_reset_note_presence(commandEngine(), pauseMs);
}

}  // namespace kitbag
