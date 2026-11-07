#ifndef KITBAG_MIXER_TRANSPORT_PLAN_H
#define KITBAG_MIXER_TRANSPORT_PLAN_H

#include <cstdint>

#include "media/loop_layout.h"

namespace kitbag {

inline constexpr float kUnityRate = 1.0f;

// kHandOver keeps the live sources and switches to a primed bank at exactly
// stream frame `frame`; a jump with `primed` starts output from its bank.
enum class PlanKind : uint8_t { kJump, kKeep, kHandOver };

// Published, never queued: a dropped plan would strand every track on an
// epoch the callback never adopts.
struct TransportPlan {
  PlanKind kind = PlanKind::kJump;
  int64_t frame = 0;
  // The transport frame at which the head stands at `frame`.
  int64_t base = 0;
  LoopLayout layout;
  uint64_t epoch = 0;
  bool primed = false;
  // A re-prime of the head, no user's jump: it means no beat again.
  bool continues = false;
  int bank = 0;
  uint64_t generation = 0;
  float rate = kUnityRate;
  int64_t lag = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_TRANSPORT_PLAN_H
