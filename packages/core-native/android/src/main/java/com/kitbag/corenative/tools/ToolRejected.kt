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
  INDEX,
  OTHER_RELEASE,
  NOT_IN_INDEX,
  NOT_AS_INDEXED,
  DOWNLOADS_OFF,
  ROLLBACK,
  INCOMPATIBLE,
  NO_SPACE,
  OFFLINE,
  DOWNLOAD,
  NOT_HTTPS,
  TOO_MANY_REDIRECTS,
  TOO_LARGE,
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
