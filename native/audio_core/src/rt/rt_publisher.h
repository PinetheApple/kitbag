#ifndef KITBAG_RT_RT_PUBLISHER_H
#define KITBAG_RT_RT_PUBLISHER_H

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "rt/frame_clock.h"

namespace kitbag {

// One app thread publishes; the callback loads once per block. A retired node is
// freed once the clock, read after the swap, has moved a grace window past it.
template <typename T>
class RtPublisher {
 public:
  // One second at 48kHz. Freeing late holds a few kilobytes briefly; freeing
  // early is a use-after-free in the callback.
  static constexpr uint64_t kReclaimGraceFrames = 48000;

  // The generation lives in the node so one load carries value and identity.
  struct Node {
    T value;
    uint64_t generation;
  };

  RtPublisher() = default;
  ~RtPublisher() {
    delete active_.load(std::memory_order_relaxed);
  }

  RtPublisher(const RtPublisher&) = delete;
  RtPublisher& operator=(const RtPublisher&) = delete;

  // nullptr publishes "no payload". `rt_reader_active` must be true whenever
  // the callback can run; false frees every retired payload at once.
  void
  Publish(std::unique_ptr<T> payload, FrameClock clock, bool rt_reader_active) {
    Collect(clock.Now());
    Node* node = nullptr;
    if (payload != nullptr) {
      node = new Node{std::move(*payload), ++generation_};
    }
    // seq_cst with Get and the engine's clock: swap-then-read-clock against
    // tick-then-load is store buffering, which acq_rel lets both sides miss.
    Node* previous = active_.exchange(node, std::memory_order_seq_cst);
    const uint64_t retired_at = clock.Now();
    if (previous != nullptr) {
      retired_.push_back({std::unique_ptr<Node>(previous), retired_at});
    }
    if (!rt_reader_active) {
      ReclaimAll();
    }
  }

  // Realtime thread. Compare `generation`, not the address: a freed payload's
  // address can be recycled.
  const Node* Get() const {
    return active_.load(std::memory_order_seq_cst);
  }

  void Collect(uint64_t now_frame) {
    auto reclaimable = [now_frame](const Retired& entry) {
      return now_frame > entry.frame + kReclaimGraceFrames;
    };
    retired_.erase(
        std::remove_if(retired_.begin(), retired_.end(), reclaimable),
        retired_.end()
    );
  }

  // The caller must guarantee the callback is not running.
  void ReclaimAll() {
    retired_.clear();
  }

  size_t retired_size() const {
    return retired_.size();
  }

 private:
  struct Retired {
    std::unique_ptr<Node> payload;
    uint64_t frame;
  };

  std::atomic<Node*> active_{nullptr};
  uint64_t generation_ = 0;
  std::vector<Retired> retired_;
};

}  // namespace kitbag

#endif  // KITBAG_RT_RT_PUBLISHER_H
