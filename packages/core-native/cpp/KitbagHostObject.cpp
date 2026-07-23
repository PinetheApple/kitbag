// Implementation of the JSI HostObject (SPEC §13.2).
//
// STATUS: UNCOMPILED SCAFFOLDING — see KitbagHostObject.h. No native build wired
// until #31; this has compiled and run nowhere. It is the contract skeleton.
//
// The six reads are exactly the polled realtime set (SPEC §13.2, §13.3):
// bar_phase, current_beat, current_bpm, frames_rendered, tuner_snapshot,
// player_position. Each is a synchronous straight-through call — the read path a
// Reanimated worklet polls on the UI thread. Nothing here is async or allocates
// per call beyond the jsi::Function wrapper JSI requires.

#include "KitbagHostObject.h"

#include <string>

#include "kitbag_api.h"

namespace kitbag {

using facebook::jsi::Function;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::Value;

namespace {

// Wrap a zero-arg C ABI read returning a double-representable scalar.
template <typename Fn>
Value makeReader(Runtime& rt, const std::string& name, Fn&& read) {
  return Function::createFromHostFunction(
      rt,
      PropNameID::forUtf8(rt, name),
      0,
      [read = std::forward<Fn>(read)](
          Runtime&, const Value&, const Value*, size_t) -> Value {
        return Value(static_cast<double>(read()));
      });
}

}  // namespace

Value KitbagHostObject::get(Runtime& rt, const PropNameID& name) {
  const std::string prop = name.utf8(rt);
  kb_engine* engine = engine_;

  if (prop == "bar_phase") {
    return makeReader(rt, prop, [engine] { return kb_metronome_bar_phase(engine); });
  }
  if (prop == "current_beat") {
    return makeReader(rt, prop, [engine] {
      return kb_metronome_current_beat(engine);
    });
  }
  if (prop == "current_bpm") {
    return makeReader(rt, prop, [engine] {
      return kb_metronome_current_bpm(engine);
    });
  }
  if (prop == "frames_rendered") {
    return makeReader(rt, prop, [engine] {
      return kb_engine_frames_rendered(engine);
    });
  }
  if (prop == "tuner_snapshot") {
    // uint64, 48 bits used — exact as a double, decoded in src/host/snapshot.ts.
    return makeReader(rt, prop, [engine] { return kb_tuner_snapshot(engine); });
  }
  if (prop == "player_position") {
    return makeReader(rt, prop, [engine] { return kb_player_position(engine); });
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
