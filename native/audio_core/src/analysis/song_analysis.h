#ifndef KITBAG_ANALYSIS_SONG_ANALYSIS_H
#define KITBAG_ANALYSIS_SONG_ANALYSIS_H

#include "kitbag_api.h"

#include <cstdint>

#include "analysis/beat_tracker.h"
#include "media/decoder.h"

namespace kitbag {

// Peak buckets across the whole file — the scrubber's horizontal resolution.
// Shared with analyze_verify so its chunk-count expectation tracks a retune.
constexpr int kWaveformTargetChunks = 2000;

/// Narrows a frame count to int, returning false above INT_MAX instead of
/// wrapping to a negative silently. A wrapped count reaches ComputeWaveformPeaks
/// as a skipped sidecar with no error — SPEC.md §4.
bool NarrowFrames(uint64_t frames, int* out);

/// Downmix, beat-track and emit the waveform sidecar over an already-decoded
/// interleaved buffer. Rejects channels==0, >INT_MAX frames and non-finite
/// samples with KB_ERROR_INVALID_ARGUMENT: SPEC.md is silent on non-finite
/// input, so this reuses the documented argument-error code rather than mint a
/// new policy.
kb_result AnalyzeDecodedPcm(
    const float* pcm,
    uint64_t total_frames,
    const DecoderInfo& info,
    const char* path,
    const char* waveform_dir,
    BeatResult* out
);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_SONG_ANALYSIS_H
