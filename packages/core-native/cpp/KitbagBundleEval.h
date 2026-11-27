#ifndef KITBAG_BUNDLE_EVAL_H
#define KITBAG_BUNDLE_EVAL_H

#include <jsi/jsi.h>

namespace kitbag {

// Must equal BUNDLE_EVAL_KEY in src/spike/bundleEval.ts.
inline constexpr const char* kBundleEvalKey = "__kitbagEvalBundle";

void installBundleEval(facebook::jsi::Runtime& rt);

}  // namespace kitbag

#endif  // KITBAG_BUNDLE_EVAL_H
