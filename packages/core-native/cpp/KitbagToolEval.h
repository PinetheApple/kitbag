#ifndef KITBAG_TOOL_EVAL_H
#define KITBAG_TOOL_EVAL_H

#include <cstdint>
#include <optional>
#include <string>

#include "VerifiedTools.h"

namespace facebook::jsi {
class Runtime;
}  // namespace facebook::jsi

namespace kitbag {

/// __kitbagEvalVerifiedTool(toolId) evaluates the bundle Kotlin handed off for
/// toolId and returns undefined. Before evaluating it never throws: a refusal
/// returns {refused: <kToolError* code other than Eval>, detail: <text>}. Any
/// throw from evaluation, compile error or the tool's own, is rethrown as an
/// Error whose message starts "E_TOOL_EVAL: ". The handed-off bytes are used
/// once, refused or not.
inline constexpr const char* kEvalVerifiedToolKey = "__kitbagEvalVerifiedTool";
inline constexpr const char* kToolRefusalKey = "refused";
inline constexpr const char* kToolRefusalDetailKey = "detail";

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

struct ToolEvalPlan {
  const char* refusal = nullptr;
  std::string detail;
  VerifiedBundle bundle;
};

ToolEvalPlan PlanToolEval(
    VerifiedToolStore& store,
    const std::string& tool_id,
    std::optional<uint32_t> runtime_version
);

void InstallToolEval(facebook::jsi::Runtime& rt);

}  // namespace kitbag

#endif  // KITBAG_TOOL_EVAL_H
