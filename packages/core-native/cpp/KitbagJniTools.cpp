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
constexpr const char* kOverCap = "tool bytecode exceeds the native cap";

void ThrowJava(JNIEnv* env, const char* class_name, const char* message) {
  jclass cls = env->FindClass(class_name);
  if (cls != nullptr) env->ThrowNew(cls, message);
}

std::optional<std::vector<uint8_t>>
CopyBytecode(JNIEnv* env, jbyteArray bytecode) {
  const jsize length = env->GetArrayLength(bytecode);
  if (!kitbag::ToolBytecodeFits(static_cast<std::size_t>(length))) {
    ThrowJava(env, kIllegalArgument, kOverCap);
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

void Store(
    JNIEnv* env,
    const char* tool_id,
    std::vector<uint8_t> bytes,
    uint32_t bytecode_version
) {
  const auto result = kitbag::VerifiedTools().HandOff(
      tool_id,
      {std::move(bytes), bytecode_version}
  );
  if (result == kitbag::HandOffResult::kStoreFull) {
    ThrowJava(env, kIllegalState, "too many tools awaiting evaluation");
  } else if (result == kitbag::HandOffResult::kTooLarge) {
    ThrowJava(env, kIllegalArgument, kOverCap);
  }
}

}  // namespace

extern "C" {

JNIEXPORT void JNICALL
Java_com_kitbag_corenative_tools_VerifiedToolHandoff_nativeHandOff(
    JNIEnv* env,
    jobject,
    jstring tool_id,
    jbyteArray bytecode,
    jint bytecode_version
) {
  if (tool_id == nullptr || bytecode == nullptr) {
    ThrowJava(env, kNullPointer, "toolId and bytecode are required");
    return;
  }
  if (bytecode_version < 0) {
    ThrowJava(env, kIllegalArgument, "bytecode version is negative");
    return;
  }
  const kitbag::JniUtf id(env, tool_id);
  if (id.get() == nullptr) return;
  try {
    auto bytes = CopyBytecode(env, bytecode);
    if (!bytes) return;
    Store(
        env,
        id.get(),
        std::move(*bytes),
        static_cast<uint32_t>(bytecode_version)
    );
  } catch (const std::bad_alloc&) {
    ThrowJava(env, kOutOfMemory, "cannot hold tool bytecode");
  }
}

JNIEXPORT jboolean JNICALL
Java_com_kitbag_corenative_tools_VerifiedToolHandoff_nativeDrop(
    JNIEnv* env,
    jobject,
    jstring tool_id
) {
  if (tool_id == nullptr) {
    ThrowJava(env, kNullPointer, "toolId is required");
    return JNI_FALSE;
  }
  const kitbag::JniUtf id(env, tool_id);
  if (id.get() == nullptr) return JNI_FALSE;
  return kitbag::VerifiedTools().Drop(id.get()) ? JNI_TRUE : JNI_FALSE;
}

}  // extern "C"

#endif  // __ANDROID__
