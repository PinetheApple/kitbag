package com.kitbag.corenative.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class ToolInstallerStateTest {
  private val installed = InstalledTools(Files.createTempDirectory("kitbag-state").toFile().apply { deleteOnExit() }, RULES)
  private val file = File(installed.toolsDir, ".installer.json")

  @Test
  fun `downloads start unasked and persist`() {
    assertEquals(ToolDownloads.UNASKED, stateIn(installed).downloads())

    stateIn(installed).setDownloads(ToolDownloads.ON) { emptyMap() }

    assertEquals(ToolDownloads.ON, stateIn(installed).downloads())
  }

  @Test
  fun `the high-water mark rises and never falls`() {
    val state = stateIn(installed)

    state.raiseHighWater(TestTool.ID, HighWaterMark("1.10.0", SHA_A))
    state.raiseHighWater(TestTool.ID, HighWaterMark("1.9.9", SHA_B))
    assertEquals("1.10.0", stateIn(installed).highWater(TestTool.ID)?.version)

    state.raiseHighWater(TestTool.ID, HighWaterMark("1.10.0", SHA_B))
    assertEquals(SHA_B, stateIn(installed).highWater(TestTool.ID)?.manifestSha256)
  }

  @Test
  fun `an unreadable state is downloads off and refuses rollback reads`() {
    file.parentFile!!.mkdirs()
    file.writeText("{not json")
    val state = stateIn(installed)

    assertEquals(ToolDownloads.OFF, state.downloads())
    assertEquals(ToolRejection.IO, rejectedWith { state.highWater(TestTool.ID) }?.rejection)
  }

  @Test
  fun `a mark with a malformed version makes the whole state unreadable`() {
    stateIn(installed).raiseHighWater(TestTool.ID, HighWaterMark("1.2.3", SHA_A))
    file.writeText(file.readText().replace("1.2.3", "1.2.x"))

    assertEquals(ToolDownloads.OFF, stateIn(installed).downloads())
    assertEquals(ToolRejection.IO, rejectedWith { stateIn(installed).highWater(TestTool.ID) }?.rejection)
  }

  @Test
  fun `turning downloads on over an unreadable state writes the floor it is given`() {
    file.parentFile!!.mkdirs()
    file.writeText("{not json")

    stateIn(installed).setDownloads(ToolDownloads.ON) { mapOf(TestTool.ID to HighWaterMark("3.0.0", SHA_B)) }

    assertEquals(ToolDownloads.ON, stateIn(installed).downloads())
    assertEquals("3.0.0", stateIn(installed).highWater(TestTool.ID)?.version)
  }

  @Test
  fun `versions compare numerically, however long their parts`() {
    assertTrue(ToolVersions.compare("1.10.0", "1.9.0") > 0)
    assertTrue(ToolVersions.compare("1.2.3", "99999999999999999999.0.0") < 0)
    assertEquals(0, ToolVersions.compare("2.0.0", "2.0.0"))
  }

  private companion object {
    val SHA_A = "a".repeat(64)
    val SHA_B = "b".repeat(64)
  }
}
