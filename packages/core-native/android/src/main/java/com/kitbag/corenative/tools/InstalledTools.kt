package com.kitbag.corenative.tools

import java.io.File
import java.io.IOException

internal fun ensureDir(dir: File): File {
  if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create ${dir.name}")
  return dir
}

internal class InstalledTools(root: File, private val rules: ToolBundleRules) {
  val toolsDir = File(root, TOOLS_DIR)
  val stagingDir = File(toolsDir, STAGING_DIR)

  fun requireValidId(id: String) {
    if (!rules.id.matches(id)) reject(ToolRejection.BAD_ID, "$id is not a tool id")
  }

  fun toolDir(id: String): File {
    requireValidId(id)
    return File(toolsDir, id)
  }

  fun kbtFile(id: String): File = File(toolDir(id), id + rules.kbtExtension)

  fun installedIds(): List<String> =
    toolsDir.listFiles().orEmpty().map { it.name }.filter { rules.id.matches(it) && kbtFile(it).isFile }.sorted()

  private companion object {
    const val TOOLS_DIR = "tools"
    const val STAGING_DIR = ".staging"
  }
}

internal interface BytecodeHandOff {
  fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int)

  fun drop(toolId: String): Boolean
}

internal class InstalledToolLoader(
  private val installed: InstalledTools,
  private val rules: ToolBundleRules,
  private val keys: () -> ToolKeyRing,
  private val handOff: BytecodeHandOff,
) {
  fun load(id: String) {
    val file = installed.kbtFile(id)
    try {
      if (!file.isFile) reject(ToolRejection.NOT_INSTALLED, "$id is not installed")
      if (file.length() > rules.inflatedMaxBytes) reject(ToolRejection.ZIP, "$id is larger than any bundle may be")
      val tool = ToolVerifier(rules, keys()).verify(file.readBytes(), id, ToolKeyUse.LOAD)
      handOffVerified(tool)
    } catch (error: Throwable) {
      handOff.drop(id)
      throw error
    }
  }

  private fun handOffVerified(tool: VerifiedTool) {
    try {
      handOff.handOff(tool.id, tool.bytecode, tool.bytecodeVersion)
    } catch (error: RuntimeException) {
      reject(ToolRejection.HANDOFF, "native refused ${tool.id}: ${error.message}", error)
    } catch (error: OutOfMemoryError) {
      reject(ToolRejection.HANDOFF, "native cannot hold ${tool.id}", error)
    }
  }
}
