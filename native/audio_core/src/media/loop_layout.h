#ifndef KITBAG_MEDIA_LOOP_LAYOUT_H
#define KITBAG_MEDIA_LOOP_LAYOUT_H

#include <cmath>
#include <cstdint>

namespace kitbag {

// Stream frames are linear up to `end`, then [start, end) repeats. Each pass
// opens with a `crossfade`-frame blend, reported as the head's song frames.
struct LoopLayout {
  bool looping = false;
  int64_t start = 0;
  int64_t end = 0;
  int64_t crossfade = 0;

  int64_t SongFrameAt(int64_t stream_frame) const {
    if (!looping || stream_frame < end) return stream_frame;
    return start + (stream_frame - end) % (end - start);
  }
  double SongFrameAt(double stream_frame) const {
    if (!looping || stream_frame < static_cast<double>(end)) {
      return stream_frame;
    }
    return static_cast<double>(start) +
           std::fmod(stream_frame - static_cast<double>(end), Length());
  }
  // 0 before the first wrap, then n during the nth pass.
  int64_t PassAt(double stream_frame) const {
    if (!looping || stream_frame < static_cast<double>(end)) return 0;
    return static_cast<int64_t>(
               (stream_frame - static_cast<double>(end)) / Length()
           ) +
           1;
  }
  double Length() const {
    return static_cast<double>(end - start);
  }
};

// The mixer's transport for one callback block: block frame i sounds song frame
// layout.SongFrameAt(first + i) while i < frames.
struct SongClock {
  bool playing = false;
  int64_t first = 0;
  uint32_t frames = 0;
  LoopLayout layout;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_LOOP_LAYOUT_H
