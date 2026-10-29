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

struct TrainerProp {
  const char* name;
  double (*read)(const kb_engine*);
};

constexpr TrainerProp kTrainerProps[] = {
    {"bar_muted",
     [](const kb_engine* e) { return static_cast<double>(kb_metronome_bar_muted(e)); }},
    {"bar_mute_position",
     [](const kb_engine* e) { return static_cast<double>(kb_metronome_bar_mute_position(e)); }},
    {"count_in_bar",
     [](const kb_engine* e) { return static_cast<double>(kb_metronome_count_in_bar(e)); }},
    {"ramp_state",
     [](const kb_engine* e) { return static_cast<double>(kb_metronome_ramp_state(e)); }},
    {"ramp_next_bpm",
     [](const kb_engine* e) { return kb_metronome_ramp_next_bpm(e); }},
    {"ramp_remaining",
     [](const kb_engine* e) { return kb_metronome_ramp_remaining(e); }},
    {"ramp_step_progress",
     [](const kb_engine* e) { return kb_metronome_ramp_step_progress(e); }},
};

const TrainerProp* findTrainerProp(const std::string& prop) {
  for (const TrainerProp& entry : kTrainerProps) {
    if (prop == entry.name) return &entry;
  }
  return nullptr;
}

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
  if (const TrainerProp* trainer = findTrainerProp(prop)) {
    return trainer->read(engine);
  }
  if (const TunerProp* tuner = findTunerProp(prop)) {
    kb_tuner_state state{};
    kb_tuner_read_state(engine, &state);
    return tuner->read(state);
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
  for (const TrainerProp& entry : kTrainerProps) {
    names.push_back(PropNameID::forUtf8(rt, entry.name));
  }
  for (const TunerProp& entry : kTunerProps) {
    names.push_back(PropNameID::forUtf8(rt, entry.name));
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
