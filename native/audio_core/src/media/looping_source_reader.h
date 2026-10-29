#ifndef KITBAG_MEDIA_LOOPING_SOURCE_READER_H
#define KITBAG_MEDIA_LOOPING_SOURCE_READER_H

#include <cstdint>
#include <vector>

#include "media/audio_source.h"
#include "media/loop_layout.h"

namespace kitbag {

// Reads its base in LoopLayout order on the read-ahead thread, so the ring holds
// the loop head before the wrap and the callback drains a linear stream.
class LoopingSourceReader : public SourceReader {
 public:
  LoopingSourceReader(SourceReader* base, const LoopLayout& layout);

  uint32_t channels() const override {
    return channels_;
  }
  uint32_t sample_rate() const override {
    return base_->sample_rate();
  }
  uint64_t total_frames() const override {
    return base_->total_frames();
  }
  // Never ends: past the base's end, or past a short stem's, it reads silence.
  ReadResult ReadFrames(float* dst, uint64_t frames) override;
  // [frame] is a stream frame, so it may lie passes beyond the loop end.
  bool SeekToFrame(uint64_t frame) override;

 private:
  uint64_t ReadSegment(float* dst, uint64_t frames);
  void ReadBase(float* dst, uint64_t frames);
  void SeekBase(int64_t frame);
  void PrepareCrossfade();

  SourceReader* base_;
  LoopLayout layout_;
  uint32_t channels_;
  int64_t stream_frame_ = 0;
  int64_t base_frame_ = 0;
  bool base_live_ = true;
  std::vector<float> tail_;
  std::vector<float> blend_;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_LOOPING_SOURCE_READER_H
