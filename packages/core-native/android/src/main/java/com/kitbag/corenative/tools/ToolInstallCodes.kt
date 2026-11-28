package com.kitbag.corenative.tools

internal enum class ToolInstallStage {
  DOWNLOADING,
  RETRYING,
  CHECKING,
  INSTALLING,
  INSTALLED,
  FAILED,
  CANCELLED,
  ;

  val code: String get() = "$STAGE_PREFIX$name"

  private companion object {
    const val STAGE_PREFIX = "TOOL_STAGE_"
  }
}

internal enum class ToolDownloads {
  UNASKED,
  ON,
  OFF,
  ;

  val code: String get() = "$DOWNLOADS_PREFIX$name"

  companion object {
    private const val DOWNLOADS_PREFIX = "TOOL_DOWNLOADS_"

    fun ofCode(code: String): ToolDownloads? = entries.firstOrNull { it.code == code }
  }
}
