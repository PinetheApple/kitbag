#ifndef KITBAG_MEDIA_SONG_CLOCK_H
#define KITBAG_MEDIA_SONG_CLOCK_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "media/loop_layout.h"

namespace kitbag {

// From output frame out_first on, the stretch is fed stream frame
// fed_first + rate * (out - out_first), numbered under `layout`.
struct SongRecord {
  int64_t out_first = 0;
  double fed_first = 0.0;
  double rate = 1.0;
  LoopLayout layout;
};

// Output frame j sounds stream frame fed(j - out) - in: the vendor's latency
// model, with in/out the stretch's input and output latency.
class SongRecords {
 public:
  void Reserve(size_t capacity) {
    ring_.assign(capacity, {});
    count_ = 0;
  }
  void Reset(const SongRecord& record, int64_t in, int64_t out) {
    in_ = in;
    out_ = out;
    count_ = 0;
    Push(record);
  }
  // Overwrites the oldest once full; a query older than the oldest clamps.
  void Push(const SongRecord& record) {
    if (ring_.empty()) return;
    head_ = (head_ + 1) % ring_.size();
    ring_[head_] = record;
    count_ = std::min(count_ + 1, ring_.size());
  }
  const SongRecord& newest() const {
    return ring_[head_];
  }
  int64_t AudibleAt(int64_t out_frame) const {
    const int64_t at = out_frame - out_;
    const SongRecord& record = Find(at);
    const double fed = record.fed_first +
                       record.rate * static_cast<double>(at - record.out_first);
    const auto stream = static_cast<int64_t>(std::floor(fed)) - in_;
    return std::max<int64_t>(record.layout.SongFrameAt(stream), 0);
  }
  const LoopLayout& LayoutAt(int64_t out_frame) const {
    return Find(out_frame - out_).layout;
  }

 private:
  const SongRecord& Find(int64_t at) const {
    size_t index = head_;
    for (size_t k = 0; k < count_; ++k) {
      index = (head_ + ring_.size() - k) % ring_.size();
      if (ring_[index].out_first <= at) return ring_[index];
    }
    return ring_[index];
  }

  std::vector<SongRecord> ring_;
  size_t head_ = 0;
  size_t count_ = 0;
  int64_t in_ = 0;
  int64_t out_ = 0;
};

// With records, `first` is an output frame, not a stream frame.
struct SongClock {
  bool playing = false;
  int64_t first = 0;
  uint32_t frames = 0;
  LoopLayout layout;
  const SongRecords* records = nullptr;

  int64_t SongFrameAt(uint32_t i) const {
    return records == nullptr ? layout.SongFrameAt(first + i)
                              : records->AudibleAt(first + i);
  }
  const LoopLayout& LayoutAt(uint32_t i) const {
    return records == nullptr ? layout : records->LayoutAt(first + i);
  }
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_SONG_CLOCK_H
