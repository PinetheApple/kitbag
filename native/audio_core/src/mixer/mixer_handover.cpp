#include <cstdint>

#include "mixer/mixer.h"

namespace kitbag {

// Judged once, at first sight: a frame already passed is refused, and one
// still ahead cannot be passed later, since every block checks it.
void Mixer::JudgeHandOver(const TransportPlan& plan) {
  handover_pending_ =
      !engaged_.load(std::memory_order_relaxed) && stream_frame_ <= plan.frame;
  if (handover_pending_) {
    handover_ = plan;
  } else {
    missed_generation_.store(plan.generation, std::memory_order_relaxed);
  }
  seen_generation_.store(plan.generation, std::memory_order_release);
}

// The bank was primed on the app thread from [head, head + lag), so its next
// output frame is the head and the sources carry on from head + lag.
bool Mixer::EngageAt(const TransportPlan& plan, int64_t bypass_frames) {
  handover_pending_ = false;
  bank_ = plan.bank;
  SnapshotBuses();
  const KeyBus* any = AnyBus();
  if (any == nullptr || !BusesAgree(plan.generation)) return false;
  rate_ = plan.rate;
  carry_ = 0.0;
  primed_generation_ = plan.generation;
  ResetRecords(any->stretch, bypass_frames);
  stream_frame_ += plan.lag;
  transport_frame_.fetch_add(plan.lag, std::memory_order_relaxed);
  seam_left_ = plan.kind == PlanKind::kHandOver ? crossfade_frames_ : 0;
  engaged_.store(true, std::memory_order_relaxed);
  return true;
}

// The first record maps the block's bypass frames 1:1, the second the
// stretched output from the head on.
void Mixer::ResetRecords(const TimeStretch& stretch, int64_t bypass_frames) {
  const int64_t in = stretch.InputLatencyFrames();
  const int64_t out = stretch.OutputLatencyFrames();
  records_.Reset(
      {.out_first = out_clock_ - bypass_frames - out,
       .fed_first = static_cast<double>(stream_frame_ - bypass_frames + in),
       .rate = kUnityRate,
       .layout = layout_},
      in,
      out
  );
  records_.Push(
      {.out_first = out_clock_ - out,
       .fed_first = static_cast<double>(stream_frame_ + in),
       .rate = rate_,
       .layout = layout_}
  );
}

// Bypass up to the hand-over frame, then the primed bank for the rest of the
// block, so the switch lands on exactly that sample.
bool Mixer::HandOverBlock(float* output, uint32_t frame_count, bool any_solo) {
  const int64_t into = handover_.frame - stream_frame_;
  if (into < 0 || into >= frame_count) return false;
  const auto bypass = static_cast<uint32_t>(into);
  if (bypass > 0) {
    MixAllTracks(output, bypass, any_solo);
    AdvanceTransport(bypass);
    if (stream_frame_ != handover_.frame) return true;
  }
  out_clock_ += bypass;
  float* rest = output + static_cast<size_t>(bypass) * KeyBus::kChannels;
  const uint32_t left = frame_count - bypass;
  if (!EngageAt(handover_, bypass)) {
    MixAllTracks(rest, left, any_solo);
    AdvanceTransport(left);
    return true;
  }
  StretchBlock(rest, left, any_solo);
  if (song_clock_.records != nullptr) {
    song_clock_.first -= bypass;
    song_clock_.frames += bypass;
  }
  return true;
}

}  // namespace kitbag
