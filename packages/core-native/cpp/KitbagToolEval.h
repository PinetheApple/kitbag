#ifndef KITBAG_TOOL_EVAL_H
#define KITBAG_TOOL_EVAL_H

#include <jsi/jsi.h>

namespace kitbag {

inline constexpr const char* kEvalVerifiedToolKey = "__kitbagEvalVerifiedTool";

inline constexpr const char* kToolErrorArgument = "E_TOOL_ARGUMENT";
inline constexpr const char* kToolErrorNotVerified = "E_TOOL_NOT_VERIFIED";
inline constexpr const char* kToolErrorRuntimeVersion =
    "E_TOOL_RUNTIME_VERSION";
inline constexpr const char* kToolErrorNotBytecode = "E_TOOL_NOT_BYTECODE";
inline constexpr const char* kToolErrorManifestVersion =
    "E_TOOL_MANIFEST_VERSION";
inline constexpr const char* kToolErrorBytecodeVersion =
    "E_TOOL_BYTECODE_VERSION";
inline constexpr const char* kToolErrorEval = "E_TOOL_EVAL";

void installToolEval(facebook::jsi::Runtime& rt);

}  // namespace kitbag

#endif  // KITBAG_TOOL_EVAL_H
