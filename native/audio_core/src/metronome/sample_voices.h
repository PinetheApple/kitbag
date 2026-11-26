#ifndef KITBAG_METRONOME_SAMPLE_VOICES_H
#define KITBAG_METRONOME_SAMPLE_VOICES_H

#include <cstddef>
#include <cstdint>
#include <vector>

#include "metronome/custom_sound_limits.h"
#include "rt/rt_publisher.h"

namespace kitbag {

// Publish, Clear and Collect are app-thread only; BeginBlock, CutAll, Trigger
// and Render are for the audio callback and allocate, free and wait on nothing.
class SampleVoices {
 public:
  static constexpr int kMaxVoices = 8;
  static constexpr uint32_t kCutFadeMs = 5;
  static constexpr uint32_t kMsPerSecond = 1000;
  static constexpr uint32_t kCutFadeFrames =
      kCustomSoundRate * kCutFadeMs / kMsPerSecond;
  // Full scale: a voice stolen again mid-fade stacks tails, and this bounds it.
  static constexpr float kMaxTail = 1.0F;

  struct Sample {
    std::vector<float> frames;
  };

  static bool IsValidSlot(int slot) {
    return slot >= 0 && slot < kCustomSoundSlots;
  }

  bool Publish(
      int slot,
      std::vector<float> frames,
      FrameClock clock,
      bool rt_reader_active
  );
  void Clear(int slot, FrameClock clock, bool rt_reader_active);
  void Collect(uint64_t now_frame);
  void ReclaimAll();
  bool loaded(int slot) const;
  size_t retired_size() const;

  // Once per block, before any Trigger or Render in it. A voice whose slot was
  // replaced or cleared stops reading here and fades from its last output.
  void BeginBlock();
  void CutAll();
  // False when the slot is empty, so the caller can sound its fallback.
  bool Trigger(int slot, float gain);
  float Render();
  bool sounding() const;

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
    float last = 0.0F;
    float fade_from = 0.0F;
    uint32_t fade_left = 0;
  };

  static float FadeLevel(const Voice& voice);
  static float Tail(const Voice& voice);
  static void Cut(Voice& voice);
  Voice* FreeOrOldest();

  RtPublisher<Sample> slots_[kCustomSoundSlots];
  SlotView views_[kCustomSoundSlots];
  Voice voices_[kMaxVoices];
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_SAMPLE_VOICES_H
