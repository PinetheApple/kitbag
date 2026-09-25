#include <algorithm>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::IsOneOf;

void Metronome::InitAccentRow(std::span<Accent> row) {
  std::fill(row.begin(), row.end(), Accent::kNormal);
  row.front() = Accent::kAccented;
}

void Metronome::SetAccentSlot(
    std::span<Accent> row,
    int32_t beat_index,
    int32_t accent
) {
  if (beat_index < 0 || static_cast<size_t>(beat_index) >= row.size()) return;
  row[static_cast<size_t>(beat_index)] = static_cast<Accent>(
      Clamp(accent, 0, static_cast<int32_t>(Accent::kAccented))
  );
}

void Metronome::ResetGrownSlots(
    std::span<Accent> row,
    int32_t old_count,
    int32_t new_count
) {
  for (int32_t slot = old_count; slot < new_count; ++slot) {
    row[static_cast<size_t>(slot)] = Accent::kNormal;
  }
}

// The valid denominators are a discrete set, so clamping an out-of-set value
// would invent a beat unit the caller never asked for; ignore it instead.
void Metronome::SetSignatureState(int32_t numerator, int32_t denominator) {
  const int32_t count = Clamp(numerator, 1, kMaxBeats);
  ResetGrownSlots(accents_, beats_per_bar_, count);
  beats_per_bar_ = count;
  if (IsOneOf(kDenominators, denominator)) {
    SetDenominatorPreservingPhase(denominator);
  }
}

void Metronome::QueuePreview(int32_t sound, bool accented) {
  if (sound < 0 || sound >= kSoundCount) return;
  pending_preview_sound_ = sound;
  pending_preview_accented_ = accented;
}

void Metronome::SetSoundsState(int32_t normal_sound, int32_t accent_sound) {
  if (normal_sound >= 0 && normal_sound < kSoundCount) {
    normal_sound_ = normal_sound;
  }
  if (accent_sound >= 0 && accent_sound < kSoundCount) {
    accent_sound_ = accent_sound;
  }
}

void Metronome::SetPolyState(bool enabled, int32_t beats) {
  const int32_t count = Clamp(beats, 2, kMaxPolyBeats);
  ResetGrownSlots(poly_accents_, poly_beats_, count);
  if (!enabled || count != poly_beats_) {
    current_poly_beat_.store(-1, std::memory_order_relaxed);
  }
  poly_enabled_ = enabled;
  poly_beats_ = count;
}

}  // namespace kitbag
