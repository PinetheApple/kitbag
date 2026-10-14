// Implementation of the JSI HostObject (SPEC §13.2).
//
// STATUS: SKELETON (#31) — see KitbagHostObject.h. The native build is wired and
// this compiles/links against kitbag_core, but it has not run inside a live RN
// runtime; that install and its on-device measurement are #33.
//
// The polled realtime set (SPEC §13.2, §13.3): bar_phase, current_beat,
// current_bpm, frames_rendered, tuner_snapshot, player_position, plus one
// tuner_* property per kb_tuner_state field (kTunerProps). Each is a
// number-valued PROPERTY, not a method: get() re-invokes the matching kb_* call
// and returns its value directly, so a worklet
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

namespace {
struct TunerProp {
  const char* name;
  double (*read)(const kb_tuner_state&);
};

// One kb_tuner_read_state copy per get(): fields from two reads may straddle a hop.
constexpr TunerProp kTunerProps[] = {
    {"tuner_measurement_id",
     [](const kb_tuner_state& s) { return static_cast<double>(s.measurement_id); }},
    {"tuner_can_hear_note",
     [](const kb_tuner_state& s) { return static_cast<double>(s.can_hear_note); }},
    {"tuner_current_string",
     [](const kb_tuner_state& s) { return static_cast<double>(s.current_string); }},
    {"tuner_possible_wrong_string",
     [](const kb_tuner_state& s) { return static_cast<double>(s.possible_wrong_string); }},
    {"tuner_wrong_string_direction",
     [](const kb_tuner_state& s) { return static_cast<double>(s.wrong_string_direction); }},
    {"tuner_status",
     [](const kb_tuner_state& s) { return static_cast<double>(s.tuning_status); }},
    {"tuner_target_midi",
     [](const kb_tuner_state& s) { return static_cast<double>(s.target_midi); }},
    {"tuner_measured_midi",
     [](const kb_tuner_state& s) { return s.measured_midi; }},
    {"tuner_error_cents",
     [](const kb_tuner_state& s) { return s.tuning_error_cents; }},
    {"tuner_in_tune_ratio",
     [](const kb_tuner_state& s) { return s.in_tune_ratio; }},
    {"tuner_in_tune_threshold_cents",
     [](const kb_tuner_state& s) { return s.in_tune_threshold_cents; }},
    {"tuner_listening_paused",
     [](const kb_tuner_state& s) { return static_cast<double>(s.listening_paused); }},
    {"tuner_no_sound_issue",
     [](const kb_tuner_state& s) { return static_cast<double>(s.no_sound_issue); }},
};

const TunerProp* findTunerProp(const std::string& prop) {
  for (const TunerProp& entry : kTunerProps) {
    if (prop == entry.name) return &entry;
  }
  return nullptr;
}
}  // namespace

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
  if (const TunerProp* tuner = findTunerProp(prop)) {
    kb_tuner_state state{};
    kb_tuner_read_state(engine, &state);
    return Value(tuner->read(state));
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
  for (const TunerProp& entry : kTunerProps) {
    names.push_back(PropNameID::forUtf8(rt, entry.name));
  }
  return names;
}

void installKitbagHostObject(Runtime& rt, kb_engine* engine) {
  auto host = std::make_shared<KitbagHostObject>(engine);
  rt.global().setProperty(
      rt, kHostObjectKey, Value(rt, facebook::jsi::Object::createFromHostObject(rt, host)));
}

}  // namespace kitbag
