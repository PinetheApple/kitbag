#ifndef KITBAG_ANALYSIS_WAV_DECLARED_LENGTH_H
#define KITBAG_ANALYSIS_WAV_DECLARED_LENGTH_H

#include <cstdint>

namespace kitbag {

// The decoder clamps a WAV's data chunk to the bytes present, so the length the
// header claims has to be read here. 0 when there is no PCM or float data size.
uint64_t WavDeclaredFrames(const char* path);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_WAV_DECLARED_LENGTH_H
