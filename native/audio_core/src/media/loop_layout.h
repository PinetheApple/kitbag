#ifndef KITBAG_MEDIA_LOOP_LAYOUT_H
#define KITBAG_MEDIA_LOOP_LAYOUT_H

#include <cstdint>

namespace kitbag {

// Stream frames are linear up to `end`, then [start, end) repeats. Each pass
// opens with a `crossfade`-frame blend, reported as the head's song frames.
struct LoopLayout {
  bool looping = false;
  int64_t start = 0;
  int64_t end = 0;
  int64_t crossfade = 0;

  int64_t Length() const {
    return end - start;
  }
  int64_t SongFrameAt(int64_t stream_frame) const {
    if (!looping || stream_frame < end) return stream_frame;
    return start + (stream_frame - end) % Length();
  }
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_LOOP_LAYOUT_H
