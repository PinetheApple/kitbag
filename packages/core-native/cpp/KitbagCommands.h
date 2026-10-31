#ifndef KITBAG_COMMANDS_H
#define KITBAG_COMMANDS_H

#include <cstdint>

namespace kitbag {

// Frame arguments are uint64 engine frames carried as doubles, exact below 2^53.
int32_t commandStart();
void commandStop();
int32_t commandHold();
void commandRelease();
int32_t commandOutputDeviceId();
void commandMetronomeStart(double anchorFrame);
void commandMetronomeStartNow();
void commandMetronomeStop();
void commandMetronomePause();

void commandSetTempo(double bpm);
int32_t commandSetGrid(const double* beatTimesSec, int32_t count, double anchorFrame);
void commandClearGrid();
void commandFollowMixer(bool enabled);

void commandSetBeats(int32_t beatsPerBar, int32_t denominator);
void commandSetSubdivision(int32_t subdivision);
void commandSetAccent(int32_t beatIndex, int32_t accent);
void commandSetPoly(bool enabled, int32_t beats);
void commandSetPolyAccent(int32_t beatIndex, int32_t accent);
void commandSetPolyAgainst(int32_t mainBeats);
void commandSetSounds(int32_t normalSound, int32_t accentSound);
void commandPreviewSound(int32_t sound, bool accented);
void commandSetCountIn(int32_t bars, bool distinct, int32_t sound);
void commandSetVolume(double volume);
void commandSetLatencyOffset(double latencyMs);

void commandSetRamp(
    bool enabled,
    double startBpm,
    double targetBpm,
    double stepBpm,
    double interval,
    int32_t unit,
    bool loop);
void commandSetBarMute(bool enabled, int32_t playBars, int32_t muteBars);

int32_t commandLoadTrack(int32_t track, const char* path);
void commandUnloadTrack(int32_t track);
void commandMixerSetGain(int32_t track, double gain);
void commandMixerSetMute(int32_t track, bool muted);
void commandMixerSetSolo(int32_t track, bool soloed);
void commandMixerSetMasterGain(double gain);
double commandMixerMasterGain();
void commandMixerPlay();
void commandMixerPause();
void commandMixerStop();
void commandMixerSeek(double frame);
int32_t commandMixerSetLoop(double startFrame, double endFrame);
int32_t commandMixerClearLoop();

// Tuner.
int32_t commandTunerStart();
void commandTunerStop();
int32_t commandTunerSetTuning(int32_t instrument, const int32_t* stringMidis, int32_t count);
int32_t commandTunerSetTargetString(int32_t stringIndex);
int32_t commandTunerSetChromatic();
int32_t commandTunerSetA4(double a4Hz);
int32_t commandTunerResetNotePresence(double pauseMs);

}  // namespace kitbag

#endif  // KITBAG_COMMANDS_H
