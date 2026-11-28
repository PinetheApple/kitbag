#include <string>
#include <utility>

#include "KitbagToolEval.h"

namespace kitbag {

namespace {

ToolEvalPlan Refused(const char* code, std::string detail) {
  return {code, std::move(detail), {}};
}

std::string VersionMismatchDetail(
    const char* what,
    uint32_t found,
    uint32_t runtime_version
) {
  return std::string(what) + " " + std::to_string(found) + ", runtime " +
         std::to_string(runtime_version);
}

ToolEvalPlan CheckedPlan(VerifiedBundle bundle, uint32_t runtime_version) {
  const BundleCheck check = CheckVerifiedBundle(bundle, runtime_version);
  if (check == BundleCheck::kOk) return {nullptr, {}, std::move(bundle)};
  if (check == BundleCheck::kNotHermesBytecode) {
    return Refused(kToolErrorNotBytecode, "no hbc header");
  }
  if (check == BundleCheck::kManifestVersionMismatch) {
    return Refused(
        kToolErrorManifestVersion,
        VersionMismatchDetail(
            "manifest pins bytecode",
            bundle.bytecode_version,
            runtime_version
        )
    );
  }
  return Refused(
      kToolErrorBytecodeVersion,
      VersionMismatchDetail(
          "bundle is bytecode",
          HbcVersion(bundle.bytecode).value_or(0),
          runtime_version
      )
  );
}

}  // namespace

ToolEvalPlan PlanToolEval(
    VerifiedToolStore& store,
    const std::string& tool_id,
    std::optional<uint32_t> runtime_version
) {
  auto bundle = store.Take(tool_id);
  if (!bundle) return Refused(kToolErrorNotVerified, "no verified bundle");
  if (!runtime_version) {
    return Refused(kToolErrorRuntimeVersion, "runtime reports no version");
  }
  return CheckedPlan(std::move(*bundle), *runtime_version);
}

}  // namespace kitbag
