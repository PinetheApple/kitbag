#ifndef KITBAG_TOOLS_SOAK_CLICK_CLASSIFIER_H
#define KITBAG_TOOLS_SOAK_CLICK_CLASSIFIER_H

#include <cstddef>
#include <vector>

#include "click_soak_types.h"

namespace click_soak {

// The last beat has no successor, so it takes its predecessor's spacing.
inline double BeatSpacing(const std::vector<double>& grid_sec, size_t beat) {
  return beat + 1 < grid_sec.size() ? grid_sec[beat + 1] - grid_sec[beat]
                                    : grid_sec[beat] - grid_sec[beat - 1];
}

// grid_sec must hold at least kMinGridBeats strictly increasing beats and may
// run past the recording; beats whose tracked slot ends after it are not judged.
Report ClassifyClicks(
    const std::vector<double>& onsets_sec,
    const std::vector<double>& grid_sec,
    double duration_sec
);

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_CLICK_CLASSIFIER_H
