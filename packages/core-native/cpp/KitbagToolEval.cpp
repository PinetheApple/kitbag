#include "KitbagToolEval.h"

#include <jsi/jsi.h>

#include <cmath>
#include <cstdint>
#include <exception>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace kitbag {

namespace {

using facebook::jsi::Function;
using facebook::jsi::JSError;
using facebook::jsi::Object;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::String;
using facebook::jsi::Value;

constexpr unsigned kArgCount = 1;
constexpr const char* kHermesInternal = "HermesInternal";
constexpr const char* kRuntimeProperties = "getRuntimeProperties";
constexpr const char* kBytecodeVersionProperty = "Bytecode Version";
constexpr const char* kSourceUrlScheme = "tool:";
constexpr const char* kUnknownThrow = "non-standard exception";

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

std::optional<uint32_t> AsVersion(const Value& value) {
  if (!value.isNumber()) return std::nullopt;
  const double number = value.getNumber();
  const bool whole = number == std::floor(number);
  if (!whole || number < 0 || number > std::numeric_limits<uint32_t>::max()) {
    return std::nullopt;
  }
  return static_cast<uint32_t>(number);
}

std::optional<uint32_t> RuntimeBytecodeVersion(Runtime& rt) {
  const Value internal = rt.global().getProperty(rt, kHermesInternal);
  if (!internal.isObject()) return std::nullopt;
  const Object internal_object = internal.getObject(rt);
  const Value getter = internal_object.getProperty(rt, kRuntimeProperties);
  if (!getter.isObject() || !getter.getObject(rt).isFunction(rt)) {
    return std::nullopt;
  }
  const Value properties =
      getter.getObject(rt).getFunction(rt).callWithThis(rt, internal_object);
  if (!properties.isObject()) return std::nullopt;
  return AsVersion(
      properties.getObject(rt).getProperty(rt, kBytecodeVersionProperty)
  );
}

std::optional<uint32_t> RuntimeBytecodeVersionOrNone(Runtime& rt) {
  try {
    return RuntimeBytecodeVersion(rt);
  } catch (const std::exception&) {
    return std::nullopt;
  }
}

Value Refusal(Runtime& rt, const char* code, const std::string& detail) {
  Object refusal(rt);
  refusal.setProperty(rt, kToolRefusalKey, String::createFromAscii(rt, code));
  refusal.setProperty(
      rt,
      kToolRefusalDetailKey,
      String::createFromUtf8(rt, detail)
  );
  return {rt, refusal};
}

[[noreturn]] void
ThrowEvalError(Runtime& rt, const std::string& tool_id, const char* what) {
  throw JSError(
      rt,
      std::string(kToolErrorEval) + ": " + kSourceUrlScheme + tool_id + " " +
          what
  );
}

Value EvalVerifiedTool(
    Runtime& rt,
    std::optional<uint32_t> runtime_version,
    const std::string& tool_id
) {
  ToolEvalPlan plan = PlanToolEval(VerifiedTools(), tool_id, runtime_version);
  if (plan.refusal != nullptr) return Refusal(rt, plan.refusal, plan.detail);
  auto buffer = std::make_shared<OwnedBuffer>(std::move(plan.bundle.bytecode));
  try {
    rt.evaluateJavaScript(buffer, kSourceUrlScheme + tool_id);
  } catch (const std::exception& error) {
    ThrowEvalError(rt, tool_id, error.what());
  } catch (...) {
    ThrowEvalError(rt, tool_id, kUnknownThrow);
  }
  return Value::undefined();
}

}  // namespace

void InstallToolEval(Runtime& rt) {
  const std::optional<uint32_t> runtime_version =
      RuntimeBytecodeVersionOrNone(rt);
  auto eval = [runtime_version](
                  Runtime& rt,
                  const Value&,
                  const Value* args,
                  size_t count
              ) {
    if (count < kArgCount || !args[0].isString()) {
      return Refusal(rt, kToolErrorArgument, "expected (toolId)");
    }
    return EvalVerifiedTool(
        rt,
        runtime_version,
        args[0].getString(rt).utf8(rt)
    );
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
