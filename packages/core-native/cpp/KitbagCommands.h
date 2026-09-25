#ifndef KITBAG_COMMANDS_H
#define KITBAG_COMMANDS_H

#include <cstdint>

namespace kitbag {

// Frame arguments are uint64 engine frames carried as doubles, exact below 2^53.
int32_t commandStart();
void commandStop();
void commandMetronomeStart(double anchorFrame);
void commandMetronomeStop();
void commandMetronomePause();

void commandSetTempo(double bpm);
int32_t commandSetGrid(const double* beatTimesSec, int32_t count, double anchorFrame);

void commandSetBeats(int32_t beatsPerBar, int32_t denominator);
void commandSetSubdivision(int32_t subdivision);
void commandSetAccent(int32_t beatIndex, int32_t accent);
void commandSetPoly(bool enabled, int32_t beats);
void commandSetPolyAccent(int32_t beatIndex, int32_t accent);
void commandSetSounds(int32_t normalSound, int32_t accentSound);
void commandPreviewSound(int32_t sound, bool accented);
void commandSetCountIn(int32_t bars, bool distinct, int32_t sound);
void commandSetVolume(double volume);
void commandSetLatencyOffset(double latencyMs);

void commandSetRamp(
    bool enabled,
    double startBpm,
    double endBpm,
    double duration,
    int32_t unit,
    bool loop);
void commandSetBarMute(bool enabled, int32_t playBars, int32_t muteBars);

int32_t commandLoadTrack(int32_t track, const char* path);

}  // namespace kitbag

#endif  // KITBAG_COMMANDS_H
