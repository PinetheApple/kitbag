#ifndef KITBAG_RT_STALL_DETECTOR_H
#define KITBAG_RT_STALL_DETECTOR_H

#include <cstdint>

namespace kitbag {

// Reports when a counter that should keep moving has held still too long. The
// engine feeds it frames_rendered: a started device whose stream died stays
// "started" in miniaudio while rendering nothing (#143).
class StallDetector {
 public:
  explicit StallDetector(uint64_t stall_ms) : stall_ms_(stall_ms) {}

  void Reset(uint64_t frames, uint64_t now_ms) {
    last_frames_ = frames;
    last_change_ms_ = now_ms;
  }

  // True once frames has not moved for stall_ms. Reporting restarts the wait,
  // so a stall that outlasts a recovery attempt is reported again later.
  bool Observe(uint64_t frames, uint64_t now_ms) {
    if (frames != last_frames_) {
      Reset(frames, now_ms);
      return false;
    }
    if (now_ms - last_change_ms_ < stall_ms_) {
      return false;
    }
    last_change_ms_ = now_ms;
    return true;
  }

 private:
  uint64_t stall_ms_;
  uint64_t last_frames_ = 0;
  uint64_t last_change_ms_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_RT_STALL_DETECTOR_H
