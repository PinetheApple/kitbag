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
    int32_t length,
    const Command& command
) {
  const int32_t beat_index = command.int_a;
  if (beat_index < 0 || beat_index >= length) return;
  row[static_cast<size_t>(beat_index)] = static_cast<Accent>(
      Clamp(command.int_b, 0, static_cast<int32_t>(Accent::kAccented))
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

bool Metronome::ApplyPatternCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kSetBeats:
      SetSignatureState(command.int_a, command.int_b);
      return true;
    case CommandType::kSetSubdivision:
      subdivision_ = Clamp(command.int_a, kMinSubdivision, kMaxSubdivision);
      return true;
    case CommandType::kSetAccent:
      SetAccentSlot(accents_, beats_per_bar_, command);
      return true;
    case CommandType::kSetPolyAccent:
      SetAccentSlot(poly_accents_, poly_beats_, command);
      return true;
    case CommandType::kSetPoly:
      SetPolyState(command.int_a != 0, command.int_b);
      return true;
    case CommandType::kSetPolyAgainst:
      SetPolyAgainstState(command.int_a);
      return true;
    default:
      return false;
  }
}

bool Metronome::ApplyOutputCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kSetSounds:
      SetSoundsState(command.int_a, command.int_b);
      return true;
    case CommandType::kPreviewSound:
      QueuePreview(command);
      return true;
    case CommandType::kSetVolume:
      volume_ = Clamp(command.value, kMinVolume, kMaxVolume);
      return true;
    default:
      return false;
  }
}

void Metronome::QueuePreview(const Command& command) {
  if (!IsValidSound(command.int_a)) return;
  if (command.int_c != preview_epoch_.load(std::memory_order_relaxed)) return;
  pending_preview_sound_ = command.int_a;
  pending_preview_accented_ = command.int_b != 0;
}

void Metronome::DropQueuedPreviews() {
  preview_epoch_.fetch_add(1, std::memory_order_relaxed);
}

void Metronome::SetSoundsState(int32_t normal_sound, int32_t accent_sound) {
  if (IsValidSound(normal_sound)) normal_sound_ = normal_sound;
  if (IsValidSound(accent_sound)) accent_sound_ = accent_sound;
}

void Metronome::SetPolyState(bool enabled, int32_t beats) {
  const int32_t count = Clamp(beats, kMinPolyBeats, kMaxPolyBeats);
  ResetGrownSlots(poly_accents_, poly_beats_, count);
  if (!enabled || count != poly_beats_) {
    current_poly_beat_.store(-1, std::memory_order_relaxed);
  }
  poly_enabled_ = enabled;
  poly_beats_ = count;
}

void Metronome::SetPolyAgainstState(int32_t main_beats) {
  const bool in_range =
      main_beats >= kMinPolyAgainst && main_beats <= kMaxPolyAgainst;
  if (in_range || main_beats == KB_POLY_AGAINST_BAR) {
    poly_against_ = main_beats;
  }
}

}  // namespace kitbag
