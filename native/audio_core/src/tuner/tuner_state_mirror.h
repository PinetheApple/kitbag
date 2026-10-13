#ifndef KITBAG_TUNER_TUNER_STATE_MIRROR_H
#define KITBAG_TUNER_TUNER_STATE_MIRROR_H

#include "kitbag_api.h"

#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>

namespace kitbag {

// kb_tuner_state promises one hop per read and no atomic is that wide, so a
// sequence count guards the words. One writer at a time, never the callback.
class TunerStateMirror {
 public:
  explicit TunerStateMirror(const kb_tuner_state& initial) {
    Store(initial);
  }

  void Store(const kb_tuner_state& state) {
    std::array<uint64_t, kWords> words{};
    std::memcpy(words.data(), &state, sizeof state);
    const uint64_t sequence = sequence_.load(std::memory_order_relaxed);
    sequence_.store(sequence + 1, std::memory_order_relaxed);
    std::atomic_thread_fence(std::memory_order_release);
    for (size_t i = 0; i < kWords; ++i) {
      words_[i].store(words[i], std::memory_order_relaxed);
    }
    sequence_.store(sequence + 2, std::memory_order_release);
  }

  // Retries only while a store is mid-flight, a few hundred nanoseconds.
  kb_tuner_state Load() const {
    std::array<uint64_t, kWords> words{};
    uint64_t before = 0;
    do {
      before = sequence_.load(std::memory_order_acquire);
      for (size_t i = 0; i < kWords; ++i) {
        words[i] = words_[i].load(std::memory_order_relaxed);
      }
      std::atomic_thread_fence(std::memory_order_acquire);
    } while ((before & 1U) != 0 ||
             before != sequence_.load(std::memory_order_relaxed));
    kb_tuner_state state{};
    std::memcpy(&state, words.data(), sizeof state);
    return state;
  }

 private:
  static constexpr size_t kWords =
      (sizeof(kb_tuner_state) + sizeof(uint64_t) - 1) / sizeof(uint64_t);

  std::atomic<uint64_t> sequence_{0};
  std::array<std::atomic<uint64_t>, kWords> words_{};
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_TUNER_STATE_MIRROR_H
