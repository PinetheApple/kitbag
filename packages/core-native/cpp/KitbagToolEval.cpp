#include "KitbagToolEval.h"

#include <cmath>
#include <cstdint>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "VerifiedTools.h"

namespace kitbag {

namespace {

using facebook::jsi::Function;
using facebook::jsi::JSError;
using facebook::jsi::JSIException;
using facebook::jsi::Object;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::Value;

constexpr unsigned kArgCount = 1;
constexpr const char* kHermesInternal = "HermesInternal";
constexpr const char* kRuntimeProperties = "getRuntimeProperties";
constexpr const char* kBytecodeVersionProperty = "Bytecode Version";
constexpr const char* kSourceUrlScheme = "tool:";

class OwnedBuffer final : public facebook::jsi::Buffer {
 public:
  explicit OwnedBuffer(std::vector<uint8_t> bytes) : bytes_(std::move(bytes)) {}
  [[nodiscard]] size_t size() const override {
    return bytes_.size();
  }
  [[nodiscard]] const uint8_t* data() const override {
    return bytes_.data();
  }

 private:
  std::vector<uint8_t> bytes_;
};

std::optional<uint32_t> asVersion(const Value& value) {
  if (!value.isNumber()) return std::nullopt;
  const double number = value.getNumber();
  const bool whole = number == std::floor(number);
  if (!whole || number < 0 || number > std::numeric_limits<uint32_t>::max()) {
    return std::nullopt;
  }
  return static_cast<uint32_t>(number);
}

std::optional<uint32_t> runtimeBytecodeVersion(Runtime& rt) {
  const Value internal = rt.global().getProperty(rt, kHermesInternal);
  if (!internal.isObject()) return std::nullopt;
  const Object internalObject = internal.getObject(rt);
  const Value getter = internalObject.getProperty(rt, kRuntimeProperties);
  if (!getter.isObject() || !getter.getObject(rt).isFunction(rt)) {
    return std::nullopt;
  }
  const Value properties =
      getter.getObject(rt).getFunction(rt).callWithThis(rt, internalObject);
  if (!properties.isObject()) return std::nullopt;
  return asVersion(
      properties.getObject(rt).getProperty(rt, kBytecodeVersionProperty)
  );
}

[[noreturn]] void throwToolError(
    Runtime& rt,
    const char* code,
    const std::string& toolId,
    const std::string& detail
) {
  throw JSError(
      rt,
      std::string(code) + ": " + kSourceUrlScheme + toolId + " " + detail
  );
}

std::string versions(uint32_t found, uint32_t runtimeVersion) {
  return std::to_string(found) + ", runtime " + std::to_string(runtimeVersion);
}

void requireRunnable(
    Runtime& rt,
    const std::string& toolId,
    const VerifiedBundle& bundle,
    uint32_t runtimeVersion
) {
  switch (checkVerifiedBundle(bundle, runtimeVersion)) {
    case BundleCheck::kOk:
      return;
    case BundleCheck::kNotHermesBytecode:
      throwToolError(rt, kToolErrorNotBytecode, toolId, "has no hbc header");
    case BundleCheck::kManifestVersionMismatch:
      throwToolError(
          rt,
          kToolErrorManifestVersion,
          toolId,
          "manifest pins bytecode " +
              versions(bundle.bytecodeVersion, runtimeVersion)
      );
    case BundleCheck::kBytecodeVersionMismatch:
      throwToolError(
          rt,
          kToolErrorBytecodeVersion,
          toolId,
          "bundle is bytecode " +
              versions(hbcVersion(bundle.bytecode).value_or(0), runtimeVersion)
      );
  }
}

Value evalVerifiedTool(
    Runtime& rt,
    std::optional<uint32_t> runtimeVersion,
    const std::string& toolId
) {
  auto bundle = verifiedTools().take(toolId);
  if (!bundle) {
    throwToolError(rt, kToolErrorNotVerified, toolId, "has no verified bundle");
  }
  if (!runtimeVersion) {
    throwToolError(
        rt,
        kToolErrorRuntimeVersion,
        toolId,
        "runtime reports no bytecode version"
    );
  }
  requireRunnable(rt, toolId, *bundle, *runtimeVersion);
  auto buffer = std::make_shared<OwnedBuffer>(std::move(bundle->bytecode));
  try {
    rt.evaluateJavaScript(buffer, kSourceUrlScheme + toolId);
  } catch (const JSError&) {
    throw;
  } catch (const JSIException& error) {
    throwToolError(rt, kToolErrorEval, toolId, error.what());
  }
  return Value::undefined();
}

}  // namespace

void installToolEval(Runtime& rt) {
  const std::optional<uint32_t> runtimeVersion = runtimeBytecodeVersion(rt);
  auto eval = [runtimeVersion](
                  Runtime& rt,
                  const Value&,
                  const Value* args,
                  size_t count
              ) {
    if (count < kArgCount || !args[0].isString()) {
      throw JSError(
          rt,
          std::string(kToolErrorArgument) + ": expected (toolId)"
      );
    }
    return evalVerifiedTool(rt, runtimeVersion, args[0].getString(rt).utf8(rt));
  };
  rt.global().setProperty(
      rt,
      kEvalVerifiedToolKey,
      Function::createFromHostFunction(
          rt,
          PropNameID::forAscii(rt, kEvalVerifiedToolKey),
          kArgCount,
          std::move(eval)
      )
  );
}

}  // namespace kitbag
