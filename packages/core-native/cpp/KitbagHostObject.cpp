#include "KitbagHostObject.h"

#include <string>

#include "kitbag_api.h"

namespace kitbag {

using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::Value;

namespace {

constexpr const char* kPropertyNames[] = {
    "bar_phase",       "current_beat",   "current_poly_beat", "counting_in",
    "current_bpm",     "frames_rendered", "tuner_snapshot",   "player_position"};

double Read(kb_engine* engine, const std::string& prop, bool* found) {
  *found = true;
  if (prop == "bar_phase") return kb_metronome_bar_phase(engine);
  if (prop == "current_beat") return kb_metronome_current_beat(engine);
  if (prop == "current_poly_beat") return kb_metronome_current_poly_beat(engine);
  if (prop == "counting_in") return kb_metronome_counting_in(engine);
  if (prop == "current_bpm") return kb_metronome_current_bpm(engine);
  if (prop == "frames_rendered") {
    return static_cast<double>(kb_engine_frames_rendered(engine));
  }
  if (prop == "tuner_snapshot") {
    return static_cast<double>(kb_tuner_snapshot(engine));
  }
  if (prop == "player_position") {
    return static_cast<double>(kb_player_position(engine));
  }
  *found = false;
  return 0.0;
}

}  // namespace

Value KitbagHostObject::get(Runtime& rt, const PropNameID& name) {
  bool found = false;
  const double value = Read(engine_, name.utf8(rt), &found);
  return found ? Value(value) : Value::undefined();
}

std::vector<PropNameID> KitbagHostObject::getPropertyNames(Runtime& rt) {
  std::vector<PropNameID> names;
  for (const char* prop : kPropertyNames) {
    names.push_back(PropNameID::forUtf8(rt, prop));
  }
  return names;
}

void installKitbagHostObject(Runtime& rt, kb_engine* engine) {
  auto host = std::make_shared<KitbagHostObject>(engine);
  rt.global().setProperty(
      rt, kHostObjectKey,
      Value(rt, facebook::jsi::Object::createFromHostObject(rt, host)));
}

}  // namespace kitbag
