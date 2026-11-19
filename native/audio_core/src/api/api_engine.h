#ifndef KITBAG_API_API_ENGINE_H
#define KITBAG_API_API_ENGINE_H

#include "kitbag_api.h"

#include "engine.h"

namespace kitbag {

/// Shared by the kb_* translation units: the ABI's opaque kb_engine is an
/// Engine, and every entry point starts by recovering it.
inline Engine* ToEngine(kb_engine* engine) {
  return reinterpret_cast<Engine*>(engine);
}

inline const Engine* ToEngine(const kb_engine* engine) {
  return reinterpret_cast<const Engine*>(engine);
}

// Stopped here, not left to the callback: a metronome start and stop drained in
// one block never show it a started metronome.
inline void StopRigClickFor(Engine* engine) {
  engine->metronome().rig_click().Stop();
  engine->SetRigClickIntent(false);
}

inline void TakeOverFromRigClick(Engine* engine) {
  engine->SetMetronomeIntent(true);
  StopRigClickFor(engine);
}

}  // namespace kitbag

#endif  // KITBAG_API_API_ENGINE_H
