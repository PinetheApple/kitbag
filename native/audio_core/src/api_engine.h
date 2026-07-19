#ifndef KITBAG_API_ENGINE_H
#define KITBAG_API_ENGINE_H

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

}  // namespace kitbag

#endif  // KITBAG_API_ENGINE_H
