#include "kitbag_api.h"

#include "api/api_engine.h"

using kitbag::Engine;
using kitbag::ToEngine;

extern "C" {

void kb_metronome_select_slot(kb_engine* engine, int32_t slot) {
  if (engine != nullptr) ToEngine(engine)->SelectMetronomeSlot(slot);
}

int32_t kb_metronome_selected_slot(const kb_engine* engine) {
  return engine == nullptr ? KB_METRONOME_SLOT_STANDALONE
                           : ToEngine(engine)->selected_metronome_slot();
}

int32_t kb_metronome_intends_to_play(const kb_engine* engine) {
  if (engine == nullptr) return 0;
  const Engine* core = ToEngine(engine);
  return core->metronome_intent() || core->metronome().is_running() ? 1 : 0;
}

void kb_metronome_slot_start_at(
    kb_engine* engine,
    int32_t slot,
    uint64_t start_frame
) {
  if (engine == nullptr || !Engine::ValidMetronomeSlot(slot)) return;
  kitbag::TakeOverFromRigClick(ToEngine(engine), slot);
  ToEngine(engine)->metronome(slot).StartAt(start_frame);
}

void kb_metronome_slot_stop(kb_engine* engine, int32_t slot) {
  if (engine == nullptr || !Engine::ValidMetronomeSlot(slot)) return;
  ToEngine(engine)->metronome(slot).Stop();
  ToEngine(engine)->SetMetronomeIntent(slot, false);
}

void kb_metronome_slot_pause(kb_engine* engine, int32_t slot) {
  if (engine == nullptr || !Engine::ValidMetronomeSlot(slot)) return;
  ToEngine(engine)->metronome(slot).Pause();
  ToEngine(engine)->SetMetronomeIntent(slot, false);
}

void kb_metronome_slot_set_tempo(kb_engine* engine, int32_t slot, double bpm) {
  if (engine == nullptr || !Engine::ValidMetronomeSlot(slot)) return;
  ToEngine(engine)->metronome(slot).SetTempo(bpm);
}

double kb_metronome_slot_current_bpm(const kb_engine* engine, int32_t slot) {
  if (engine == nullptr || !Engine::ValidMetronomeSlot(slot)) return 0.0;
  return ToEngine(engine)->metronome(slot).current_bpm();
}

}  // extern "C"
