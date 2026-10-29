#include "media/looping_source_reader.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace kitbag {
namespace {

constexpr double kQuarterTurn = std::numbers::pi / 2.0;

}  // namespace

LoopingSourceReader::LoopingSourceReader(
    SourceReader* base,
    const LoopLayout& layout
)
    : base_(base),
      layout_(layout),
      channels_(base->channels()),
      tail_(static_cast<size_t>(layout.crossfade) * channels_, 0.0F),
      blend_(static_cast<size_t>(layout.crossfade) * channels_, 0.0F) {}

ReadResult LoopingSourceReader::ReadFrames(float* dst, uint64_t frames) {
  uint64_t done = 0;
  while (done < frames) {
    const uint64_t n = ReadSegment(dst + done * channels_, frames - done);
    done += n;
    stream_frame_ += static_cast<int64_t>(n);
  }
  return {frames, ReadStatus::kOk};
}

bool LoopingSourceReader::SeekToFrame(uint64_t frame) {
  stream_frame_ = static_cast<int64_t>(frame);
  if (stream_frame_ < layout_.end) {
    SeekBase(stream_frame_);
    return true;
  }
  const int64_t into = layout_.SongFrameAt(stream_frame_) - layout_.start;
  if (into >= layout_.crossfade) {
    SeekBase(layout_.start + into);
  } else if (into > 0) {
    PrepareCrossfade();
  }
  return true;
}

uint64_t LoopingSourceReader::ReadSegment(float* dst, uint64_t frames) {
  if (stream_frame_ < layout_.end) {
    const auto n =
        std::min(frames, static_cast<uint64_t>(layout_.end - stream_frame_));
    ReadBase(dst, n);
    return n;
  }
  const int64_t into = layout_.SongFrameAt(stream_frame_) - layout_.start;
  if (into == 0) PrepareCrossfade();
  if (into < layout_.crossfade) {
    const auto n =
        std::min(frames, static_cast<uint64_t>(layout_.crossfade - into));
    std::copy_n(blend_.data() + into * channels_, n * channels_, dst);
    return n;
  }
  const auto n =
      std::min(frames, static_cast<uint64_t>(layout_.Length() - into));
  ReadBase(dst, n);
  return n;
}

void LoopingSourceReader::ReadBase(float* dst, uint64_t frames) {
  uint64_t got = 0;
  if (base_live_) got = base_->ReadFrames(dst, frames).frames;
  std::fill(dst + got * channels_, dst + frames * channels_, 0.0F);
  if (got < frames) base_live_ = false;
  base_frame_ += static_cast<int64_t>(frames);
}

void LoopingSourceReader::SeekBase(int64_t frame) {
  base_frame_ = frame;
  const auto target = static_cast<uint64_t>(frame);
  base_live_ = target < base_->total_frames() && base_->SeekToFrame(target);
}

void LoopingSourceReader::PrepareCrossfade() {
  if (base_frame_ != layout_.end) SeekBase(layout_.end);
  const auto frames = static_cast<uint64_t>(layout_.crossfade);
  ReadBase(tail_.data(), frames);
  SeekBase(layout_.start);
  ReadBase(blend_.data(), frames);
  for (uint64_t i = 0; i < frames; ++i) {
    const double angle = (static_cast<double>(i) + 0.5) * kQuarterTurn /
                         static_cast<double>(frames);
    const auto out_gain = static_cast<float>(std::cos(angle));
    const auto in_gain = static_cast<float>(std::sin(angle));
    for (uint32_t c = 0; c < channels_; ++c) {
      const size_t at = i * channels_ + c;
      blend_[at] = tail_[at] * out_gain + blend_[at] * in_gain;
    }
  }
}

}  // namespace kitbag
