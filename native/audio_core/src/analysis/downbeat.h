#ifndef KITBAG_ANALYSIS_DOWNBEAT_H
#define KITBAG_ANALYSIS_DOWNBEAT_H

#include <vector>

namespace kitbag {

/// Label which of the given beats are bar-ones (downbeats), returning indices
/// into beat_times. Wraps QM-DSP DownBeat: the beat grid comes from Kitbag's own
/// tracker, and DownBeat picks the bar phase from beat-synchronous spectral
/// difference. beats_per_bar <= 0 falls back to 4/4. App thread only.
std::vector<int> FindDownbeats(
    const float* mono,
    int num_frames,
    int sample_rate,
    const std::vector<float>& beat_times,
    int beats_per_bar
);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_DOWNBEAT_H
