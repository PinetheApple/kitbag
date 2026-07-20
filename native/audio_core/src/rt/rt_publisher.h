#ifndef KITBAG_RT_RT_PUBLISHER_H
#define KITBAG_RT_RT_PUBLISHER_H

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

namespace kitbag {

// Hands a bulk payload from the app thread to the realtime thread.
//
// The command ring (spsc_ring.h) carries scalars; anything variable-length —
// a beat grid, a decoded track — cannot fit through it without a blocking
// handshake. This is the other half of that contract: build off-thread, swap
// in by atomic pointer, never free under a reader. It is the pattern native
// track loading should adopt (SPEC.md §4.1, §4.5); today the metronome's beat
// grid is its only user, and kb_mixer_set_track_data still publishes PCM the
// old, racy way until §4.1 removes it.
//
// The callback only ever does an acquire load. It allocates nothing, frees
// nothing and waits on nothing, which is what makes it realtime-safe.
//
// Single writer: Publish/Collect/ReclaimAll are for one app thread. Concurrent
// Publish is undefined, exactly as with SpscRing's single producer.
//
// Reclamation is deferred rather than reference-counted. A reader loads the
// pointer once at the top of a block and uses it for the rest of that block,
// and the engine advances its frame counter only after that block returns — so
// once the clock has moved a grace window past the swap, no reader can still
// hold the old payload. Anything that stalls the callback stalls the clock too,
// so every failure mode defers a free rather than performing one early.
template <typename T>
class RtPublisher {
 public:
  // 48000 frames: one second at 48kHz, half at 96k. Either is orders of
  // magnitude longer than any device buffer. Being late to free costs a few
  // kilobytes held briefly; being early costs a use-after-free in the audio
  // callback, so the window is deliberately lopsided.
  static constexpr uint64_t kReclaimGraceFrames = 48000;

  // What the realtime thread sees. `generation` is strictly increasing and
  // never reused, so a reader detects a swap by comparing generations rather
  // than addresses — a freed payload's address can be recycled, a generation
  // cannot. It lives inside the node so one atomic load carries both.
  struct Node {
    T value;
    uint64_t generation;
  };

  RtPublisher() = default;
  ~RtPublisher() {
    // The engine must be stopped before the owner is destroyed, so there is no
    // reader left to protect against here.
    delete active_.load(std::memory_order_relaxed);
  }

  RtPublisher(const RtPublisher&) = delete;
  RtPublisher& operator=(const RtPublisher&) = delete;

  // App thread. `now_frame` is the engine clock at the time of the call; it
  // dates the retired payload for reclamation and nothing else. Passing nullptr
  // publishes "no payload", which is how a clear is expressed.
  //
  // `rt_reader_active` must be true whenever the audio callback can run. When
  // it is false there is no reader to protect and the clock is not moving, so
  // deferring would retain every retired payload until the engine is next
  // stopped — the caller that publishes repeatedly before playback would grow
  // without bound. Passing true when the callback is in fact stopped only
  // delays a free; passing false while it can run is a use-after-free, so the
  // caller must be certain.
  void Publish(
      std::unique_ptr<T> payload,
      uint64_t now_frame,
      bool rt_reader_active
  ) {
    Collect(now_frame);
    Node* node = nullptr;
    if (payload != nullptr) {
      node = new Node{std::move(*payload), ++generation_};
    }
    Node* previous = active_.exchange(node, std::memory_order_acq_rel);
    if (previous != nullptr) {
      retired_.push_back({std::unique_ptr<Node>(previous), now_frame});
    }
    if (!rt_reader_active) {
      ReclaimAll();
    }
  }

  // Realtime thread. May return nullptr. Compare `generation`, not the address,
  // to decide whether the payload changed.
  const Node* Get() const {
    return active_.load(std::memory_order_acquire);
  }

  // App thread. Frees payloads the clock has moved safely past. Publish calls
  // this, so a caller that keeps publishing never needs to.
  void Collect(uint64_t now_frame) {
    auto reclaimable = [now_frame](const Retired& entry) {
      return now_frame > entry.frame + kReclaimGraceFrames;
    };
    retired_.erase(
        std::remove_if(retired_.begin(), retired_.end(), reclaimable),
        retired_.end()
    );
  }

  // App thread. Frees every retired payload immediately.
  //
  // Collect can only reclaim as the clock advances, so while the engine is
  // stopped — including before it is ever started, which is when a grid is
  // usually set — nothing is reclaimable and retired payloads accumulate. The
  // caller must guarantee the audio callback is not running; Engine::Stop is
  // the place that can.
  void ReclaimAll() {
    retired_.clear();
  }

  // App thread. Payloads retired but not yet freed. Exists so the reclamation
  // policy is testable — its failure mode is silent until it is a leak or a
  // use-after-free.
  size_t retired_size() const {
    return retired_.size();
  }

 private:
  struct Retired {
    std::unique_ptr<Node> payload;
    uint64_t frame;  // engine clock when it stopped being the active payload
  };

  std::atomic<Node*> active_{nullptr};
  uint64_t generation_ = 0;       // app thread only
  std::vector<Retired> retired_;  // app thread only; never seen by the callback
};

}  // namespace kitbag

#endif  // KITBAG_RT_RT_PUBLISHER_H
