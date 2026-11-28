package com.kitbag.corenative.tools

import java.io.IOException

internal class InstalledToolState(
  val id: String,
  val version: String?,
  val manifestSha256: String?,
  val bytes: Long,
  val problem: ToolRejection?,
)

internal class ToolCatalogue(
  val index: ToolIndex?,
  val indexProblem: ToolRejection?,
  val installed: List<InstalledToolState>,
  val highWater: Map<String, HighWaterMark>,
  val highWaterProblem: ToolRejection?,
) {
  val ids: List<String> get() = (index?.tools.orEmpty().map { it.id } + installed.map { it.id }).distinct()
}

internal class InstalledToolCheck(
  private val installed: InstalledTools,
  private val rules: ToolBundleRules,
  private val keys: () -> ToolKeyRing,
) {
  fun all(): List<InstalledToolState> = installed.installedIds().map(::check)

  fun check(id: String): InstalledToolState {
    val file = installed.kbtFile(id)
    val bytes = file.length()
    fun rejected(rejection: ToolRejection) = InstalledToolState(id, null, null, bytes, rejection)
    if (bytes > rules.inflatedMaxBytes) return rejected(ToolRejection.ZIP)
    return try {
      val tool = ToolVerifier(rules, keys()).verify(file.readBytes(), id, ToolKeyUse.LOAD)
      InstalledToolState(id, tool.manifest.version, tool.manifestSha256, bytes, null)
    } catch (error: ToolRejected) {
      rejected(error.rejection)
    } catch (error: IOException) {
      rejected(ToolRejection.IO)
    }
  }
}

internal class ToolCatalogueReader(
  private val installed: InstalledToolCheck,
  private val installer: ToolInstaller,
  private val state: ToolInstallerState,
) {
  fun read(): ToolCatalogue {
    val (index, problem) = try {
      installer.verifiedIndex() to null
    } catch (error: ToolRejected) {
      null to error.rejection
    }
    val marks = state.highWaterMarks()
    val marksProblem = if (marks == null) ToolRejection.IO else null
    return ToolCatalogue(index, problem, installed.all(), marks.orEmpty(), marksProblem)
  }
}
