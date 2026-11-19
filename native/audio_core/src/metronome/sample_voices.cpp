#include "metronome/sample_voices.h"

#include <memory>
#include <utility>

namespace kitbag {

bool SampleVoices::Publish(
    int slot,
    std::vector<float> frames,
    FrameClock clock,
    bool rt_reader_active
) {
  if (!IsValidSlot(slot) || frames.empty()) return false;
  auto sample = std::make_unique<Sample>(Sample{std::move(frames)});
  slots_[slot].Publish(std::move(sample), clock, rt_reader_active);
  return true;
}

void SampleVoices::Clear(int slot, FrameClock clock, bool rt_reader_active) {
  if (IsValidSlot(slot)) {
    slots_[slot].Publish(nullptr, clock, rt_reader_active);
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
      Cut(voice);
    }
  }
}

void SampleVoices::CutAll() {
  for (Voice& voice : voices_) {
    if (voice.frames != nullptr) Cut(voice);
  }
}

void SampleVoices::Cut(Voice& voice) {
  voice.frames = nullptr;
  voice.fade_from = voice.last;
  voice.fade_left = kCutFadeFrames;
}

SampleVoices::Voice* SampleVoices::FreeOrOldest() {
  Voice* oldest = &voices_[0];
  for (Voice& voice : voices_) {
    if (voice.frames == nullptr && voice.fade_left == 0) return &voice;
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
    if (voice.frames != nullptr) {
      voice.last = voice.frames[voice.cursor] * voice.gain;
      sample += voice.last;
      if (++voice.cursor == voice.length) voice.frames = nullptr;
    } else if (voice.fade_left > 0) {
      sample += voice.fade_from * static_cast<float>(voice.fade_left) /
                static_cast<float>(kCutFadeFrames);
      --voice.fade_left;
    }
  }
  return sample;
}

}  // namespace kitbag
