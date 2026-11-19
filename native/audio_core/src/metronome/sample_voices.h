#ifndef KITBAG_METRONOME_SAMPLE_VOICES_H
#define KITBAG_METRONOME_SAMPLE_VOICES_H

#include <cstddef>
#include <cstdint>
#include <vector>

#include "metronome/custom_sound_limits.h"
#include "rt/rt_publisher.h"

namespace kitbag {

// Publish, Clear and Collect are app-thread only; BeginBlock, Trigger and
// Render run in the audio callback and allocate, free and wait on nothing.
class SampleVoices {
 public:
  static constexpr int kMaxVoices = 8;

  struct Sample {
    std::vector<float> frames;
  };

  static bool IsValidSlot(int slot) {
    return slot >= 0 && slot < kCustomSoundSlots;
  }

  // False, changing nothing, for a bad slot or no frames.
  bool Publish(
      int slot,
      std::vector<float> frames,
      uint64_t now_frame,
      bool rt_reader_active
  );
  void Clear(int slot, uint64_t now_frame, bool rt_reader_active);
  void Collect(uint64_t now_frame);
  void ReclaimAll();
  bool loaded(int slot) const;
  size_t retired_size() const;

  // Once per block, before any Trigger or Render in it. A voice whose slot was
  // replaced or cleared stops here, so no voice outlives the block it read in.
  void BeginBlock();
  // False when the slot is empty, so the caller can sound its fallback.
  bool Trigger(int slot, float gain);
  float Render();

 private:
  struct SlotView {
    const float* frames = nullptr;
    uint32_t length = 0;
    uint64_t generation = 0;
  };
  struct Voice {
    const float* frames = nullptr;
    uint32_t length = 0;
    uint32_t cursor = 0;
    float gain = 0.0F;
    int slot = 0;
    uint64_t generation = 0;
  };

  Voice* FreeOrOldest();

  RtPublisher<Sample> slots_[kCustomSoundSlots];
  SlotView views_[kCustomSoundSlots];
  Voice voices_[kMaxVoices];
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_SAMPLE_VOICES_H
