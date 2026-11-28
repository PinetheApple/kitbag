package com.kitbag.corenative.tools

internal enum class ToolRejection {
  BAD_ID,
  NOT_INSTALLED,
  ZIP,
  MANIFEST,
  UNTRUSTED_KEY,
  SIGNATURE,
  FILES,
  WRONG_TOOL,
  PINS,
  IO,
  HANDOFF,
  INTERNAL,
  CANCELLED,
  ;

  val code: String get() = "$CODE_PREFIX$name"

  private companion object {
    const val CODE_PREFIX = "E_TOOL_"
  }
}

internal class ToolRejected(
  val rejection: ToolRejection,
  message: String,
  cause: Throwable? = null,
) : Exception(message, cause)

internal fun reject(rejection: ToolRejection, message: String, cause: Throwable? = null): Nothing =
  throw ToolRejected(rejection, message, cause)
