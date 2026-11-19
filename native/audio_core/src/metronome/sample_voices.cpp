#include "metronome/sample_voices.h"

#include <memory>
#include <utility>

namespace kitbag {

bool SampleVoices::Publish(
    int slot,
    std::vector<float> frames,
    uint64_t now_frame,
    bool rt_reader_active
) {
  if (!IsValidSlot(slot) || frames.empty()) return false;
  auto sample = std::make_unique<Sample>(Sample{std::move(frames)});
  slots_[slot].Publish(std::move(sample), now_frame, rt_reader_active);
  return true;
}

void SampleVoices::Clear(int slot, uint64_t now_frame, bool rt_reader_active) {
  if (IsValidSlot(slot)) {
    slots_[slot].Publish(nullptr, now_frame, rt_reader_active);
  }
}

void SampleVoices::Collect(uint64_t now_frame) {
  for (RtPublisher<Sample>& slot : slots_) slot.Collect(now_frame);
}

void SampleVoices::ReclaimAll() {
  for (RtPublisher<Sample>& slot : slots_) slot.ReclaimAll();
}

bool SampleVoices::loaded(int slot) const {
  return IsValidSlot(slot) && slots_[slot].Get() != nullptr;
}

size_t SampleVoices::retired_size() const {
  size_t retired = 0;
  for (const RtPublisher<Sample>& slot : slots_) retired += slot.retired_size();
  return retired;
}

void SampleVoices::BeginBlock() {
  for (int slot = 0; slot < kCustomSoundSlots; ++slot) {
    const auto* node = slots_[slot].Get();
    views_[slot] = node == nullptr
                       ? SlotView{}
                       : SlotView{
                             node->value.frames.data(),
                             static_cast<uint32_t>(node->value.frames.size()),
                             node->generation
                         };
  }
  for (Voice& voice : voices_) {
    if (voice.frames != nullptr &&
        views_[voice.slot].generation != voice.generation) {
      voice.frames = nullptr;
    }
  }
}

SampleVoices::Voice* SampleVoices::FreeOrOldest() {
  Voice* oldest = &voices_[0];
  for (Voice& voice : voices_) {
    if (voice.frames == nullptr) return &voice;
    if (voice.cursor > oldest->cursor) oldest = &voice;
  }
  return oldest;
}

bool SampleVoices::Trigger(int slot, float gain) {
  if (!IsValidSlot(slot) || views_[slot].frames == nullptr) return false;
  const SlotView& view = views_[slot];
  *FreeOrOldest() =
      Voice{view.frames, view.length, 0, gain, slot, view.generation};
  return true;
}

float SampleVoices::Render() {
  float sample = 0.0F;
  for (Voice& voice : voices_) {
    if (voice.frames == nullptr) continue;
    sample += voice.frames[voice.cursor] * voice.gain;
    if (++voice.cursor == voice.length) voice.frames = nullptr;
  }
  return sample;
}

}  // namespace kitbag
