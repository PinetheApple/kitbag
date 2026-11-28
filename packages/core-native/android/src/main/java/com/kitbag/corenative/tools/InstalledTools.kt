package com.kitbag.corenative.tools

import java.io.File

internal class InstalledTools(private val root: File, private val rules: ToolBundleRules) {
  fun kbtFile(id: String): File {
    if (!rules.id.matches(id)) reject(ToolRejection.BAD_ID, "$id is not a tool id")
    return File(File(File(root, TOOLS_DIR), id), id + rules.kbtExtension)
  }

  private companion object {
    const val TOOLS_DIR = "tools"
  }
}

internal fun interface BytecodeHandOff {
  fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int)
}

internal class InstalledToolLoader(
  private val installed: InstalledTools,
  private val rules: ToolBundleRules,
  private val keys: () -> ToolKeyRing,
  private val handOff: BytecodeHandOff,
) {
  fun load(id: String) {
    val file = installed.kbtFile(id)
    if (!file.isFile) reject(ToolRejection.NOT_INSTALLED, "$id is not installed")
    if (file.length() > rules.inflatedMaxBytes) reject(ToolRejection.ZIP, "$id is larger than any bundle may be")
    val tool = ToolVerifier(rules, keys()).verify(file.readBytes(), id, ToolKeyUse.LOAD)
    handOff.handOff(tool.id, tool.bytecode, tool.bytecodeVersion)
  }
}
