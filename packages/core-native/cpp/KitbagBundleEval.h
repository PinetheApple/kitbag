#ifndef KITBAG_BUNDLE_EVAL_H
#define KITBAG_BUNDLE_EVAL_H

#include <jsi/jsi.h>

struct AAssetManager;

namespace kitbag {

// Must equal BUNDLE_EVAL_KEY and HBC_VERSION_KEY in src/spike/bundleEval.ts.
inline constexpr const char* kBundleEvalKey = "__kitbagEvalBundle";
inline constexpr const char* kHbcVersionKey = "__kitbagHbcFileVersion";

void installBundleEval(facebook::jsi::Runtime& rt, AAssetManager* assets);

}  // namespace kitbag

#endif  // KITBAG_BUNDLE_EVAL_H
