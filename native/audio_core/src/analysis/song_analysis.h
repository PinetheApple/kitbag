#ifndef KITBAG_ANALYSIS_SONG_ANALYSIS_H
#define KITBAG_ANALYSIS_SONG_ANALYSIS_H

#include "kitbag_api.h"

#include <cstdint>
#include <limits>

#include "analysis/beat_tracker.h"

namespace kitbag {

class SourceReader;

// Peak buckets across the whole file — the scrubber's horizontal resolution.
// Shared with analyze_verify so its chunk-count expectation tracks a retune.
constexpr int kWaveformTargetChunks = 2000;

// Longer input is refused: the per-hop onset arrays and the run time grow with
// length, and a decoder need not report an end. INT_MAX is the documented limit.
constexpr uint64_t kMaxAnalysisFrames = std::numeric_limits<int>::max();

bool WithinFrameCap(uint64_t frames);

// Encoder delay and padding leave a whole file a little short of its header's
// length; a shortfall past both means the file was cut short or broke mid-way.
constexpr uint64_t kDeclaredShortfallSlackFrames = 4096;
constexpr uint64_t kDeclaredShortfallFractionDivisor = 100;

bool EndsShortOfDeclared(uint64_t decoded_frames, uint64_t declared_frames);

/// Streams `reader` twice, rewinding it with SeekToFrame(0) in between: tempo
/// and beats first, then downbeats and peaks, which need the beats and length.
/// `declared_frames` is the file header's length, 0 when it has none.
kb_result AnalyzeSong(
    SourceReader& reader,
    uint64_t declared_frames,
    const char* path,
    const char* waveform_dir,
    BeatResult* out
);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_SONG_ANALYSIS_H
