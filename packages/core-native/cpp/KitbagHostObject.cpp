// Implementation of the JSI HostObject (SPEC §13.2).
//
// STATUS: SKELETON (#31) — see KitbagHostObject.h. The native build is wired and
// this compiles/links against kitbag_core, but it has not run inside a live RN
// runtime; that install and its on-device measurement are #33.
//
// The six reads are exactly the polled realtime set (SPEC §13.2, §13.3):
// bar_phase, current_beat, current_bpm, frames_rendered, tuner_snapshot,
// player_position. Each is a number-valued PROPERTY, not a method: get()
// re-invokes the matching kb_* call and returns its value directly, so a worklet
// reading global.__KitbagHostObject.bar_phase each frame on the UI thread
// allocates nothing — no jsi::Function per access, which §13.3 forbids on the
// 60fps path.

#include "KitbagHostObject.h"

#include <string>

#include "kitbag_api.h"

namespace kitbag {

using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::Value;

Value KitbagHostObject::get(Runtime& rt, const PropNameID& name) {
  const std::string prop = name.utf8(rt);
  kb_engine* engine = engine_;

  if (prop == "bar_phase") {
    return Value(static_cast<double>(kb_metronome_bar_phase(engine)));
  }
  if (prop == "current_beat") {
    return Value(static_cast<double>(kb_metronome_current_beat(engine)));
  }
  if (prop == "current_bpm") {
    return Value(static_cast<double>(kb_metronome_current_bpm(engine)));
  }
  if (prop == "frames_rendered") {
    return Value(static_cast<double>(kb_engine_frames_rendered(engine)));
  }
  if (prop == "tuner_snapshot") {
    // uint64, 48 bits used — exact as a double, decoded in src/host/snapshot.ts.
    return Value(static_cast<double>(kb_tuner_snapshot(engine)));
  }
  if (prop == "player_position") {
    return Value(static_cast<double>(kb_player_position(engine)));
  }
  return Value::undefined();
}

std::vector<PropNameID> KitbagHostObject::getPropertyNames(Runtime& rt) {
  std::vector<PropNameID> names;
  for (const char* prop :
       {"bar_phase", "current_beat", "current_bpm", "frames_rendered",
        "tuner_snapshot", "player_position"}) {
    names.push_back(PropNameID::forUtf8(rt, prop));
  }
  return names;
}

void installKitbagHostObject(Runtime& rt, kb_engine* engine) {
  auto host = std::make_shared<KitbagHostObject>(engine);
  rt.global().setProperty(
      rt, kHostObjectKey, Value(rt, facebook::jsi::Object::createFromHostObject(rt, host)));
}

}  // namespace kitbag
