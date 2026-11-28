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
  ;

  val code: String get() = "$CODE_PREFIX$name"

  private companion object {
    const val CODE_PREFIX = "E_TOOL_"
  }
}

internal class ToolRejected(val rejection: ToolRejection, message: String) : Exception(message)

internal fun reject(rejection: ToolRejection, message: String): Nothing = throw ToolRejected(rejection, message)
