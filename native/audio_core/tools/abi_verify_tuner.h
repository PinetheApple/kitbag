#ifndef KITBAG_TOOLS_ABI_VERIFY_TUNER_H
#define KITBAG_TOOLS_ABI_VERIFY_TUNER_H

#include "kitbag_api.h"

// The tuner's half of abi_verify: validation and null safety at the boundary.
// Behaviour is pinned in tuner_verify.
void RunTunerAbiTests(kb_engine* engine);

#endif  // KITBAG_TOOLS_ABI_VERIFY_TUNER_H
