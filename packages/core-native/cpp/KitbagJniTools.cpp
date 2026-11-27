#ifdef __ANDROID__

#include <jni.h>

#include <cstdint>
#include <new>
#include <optional>
#include <utility>
#include <vector>

#include "KitbagJniUtf.h"
#include "VerifiedTools.h"

namespace {

constexpr const char* kNullPointer = "java/lang/NullPointerException";
constexpr const char* kIllegalArgument = "java/lang/IllegalArgumentException";
constexpr const char* kIllegalState = "java/lang/IllegalStateException";
constexpr const char* kOutOfMemory = "java/lang/OutOfMemoryError";

void throwJava(JNIEnv* env, const char* className, const char* message) {
  jclass cls = env->FindClass(className);
  if (cls != nullptr) env->ThrowNew(cls, message);
}

std::optional<std::vector<uint8_t>>
copyBytecode(JNIEnv* env, jbyteArray bytecode) {
  const jsize length = env->GetArrayLength(bytecode);
  if (!kitbag::toolBytecodeFits(static_cast<std::size_t>(length))) {
    throwJava(env, kIllegalArgument, "tool bytecode exceeds the native cap");
    return std::nullopt;
  }
  std::vector<uint8_t> bytes(static_cast<std::size_t>(length));
  env->GetByteArrayRegion(
      bytecode,
      0,
      length,
      reinterpret_cast<jbyte*>(bytes.data())
  );
  return bytes;
}

void store(
    JNIEnv* env,
    const char* toolId,
    std::vector<uint8_t> bytes,
    uint32_t bytecodeVersion
) {
  const auto result = kitbag::verifiedTools().handOff(
      toolId,
      {std::move(bytes), bytecodeVersion}
  );
  if (result == kitbag::HandOffResult::kStoreFull) {
    throwJava(env, kIllegalState, "too many tools awaiting evaluation");
  } else if (result == kitbag::HandOffResult::kTooLarge) {
    throwJava(env, kIllegalArgument, "tool bytecode exceeds the native cap");
  }
}

}  // namespace

extern "C" {

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_tools_VerifiedToolHandoff_nativeHandOff(
    JNIEnv* env,
    jobject,
    jstring toolId,
    jbyteArray bytecode,
    jint bytecodeVersion
) {
  if (toolId == nullptr || bytecode == nullptr) {
    throwJava(env, kNullPointer, "toolId and bytecode are required");
    return;
  }
  if (bytecodeVersion < 0) {
    throwJava(env, kIllegalArgument, "bytecode version is negative");
    return;
  }
  const kitbag::JniUtf id(env, toolId);
  if (id.get() == nullptr) return;
  try {
    auto bytes = copyBytecode(env, bytecode);
    if (!bytes) return;
    store(
        env,
        id.get(),
        std::move(*bytes),
        static_cast<uint32_t>(bytecodeVersion)
    );
  } catch (const std::bad_alloc&) {
    throwJava(env, kOutOfMemory, "cannot hold tool bytecode");
  }
}

}  // extern "C"

#endif  // __ANDROID__
