// See KitbagEngine.h. SKELETON (#31): links against kitbag_core but is not yet
// driven by a live RN runtime (#33).

#include "KitbagEngine.h"

#include "KitbagHostObject.h"
#include "kitbag_api.h"

namespace kitbag {

namespace {
// The single owner of the engine in the whole codebase (SPEC §4.5). A file-local
// static rather than a member of any React object, because the engine outlives
// every React mount (§13.9): its lifetime is the process/service, not a
// component. §13.7: the type comes from kitbag_api.h, not a local re-declaration.
kb_engine* g_engine = nullptr;
}  // namespace

kb_engine* kitbagEngine() { return g_engine; }

void kitbagInstall(facebook::jsi::Runtime& rt) {
  // SKELETON (#31): lazy create, no kb_result handling, no destroy. See header
  // for what Phase 3 owes here.
  if (g_engine == nullptr) {
    kb_engine_create(&g_engine);
  }
  installKitbagHostObject(rt, g_engine);
}

}  // namespace kitbag
