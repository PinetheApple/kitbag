package com.kitbag.corenative.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class NoShippedTestKeysTest {
  private val testKeyId = Regex("\"" + Regex.escape(RULES.pinKeyIdField) + "\"\\s*:\\s*\"" + Regex.escape(RULES.testKeyPrefix))

  private fun testKeysUnder(dir: File): List<String> =
    dir.walkTopDown().filter { it.isFile && testKeyId.containsMatchIn(it.readText(Charsets.ISO_8859_1)) }
      .map { it.path }.toList()

  @Test
  fun `no test- key is pinned in the main or github source sets`() {
    val mustExist = listOf(File(CORE_NATIVE_MAIN), File(APP_MAIN))
    for (dir in mustExist) assertTrue("${dir.absolutePath} must exist, or this test checks nothing", dir.isDirectory)

    val found = (mustExist + File(APP_GITHUB)).filter { it.isDirectory }.flatMap { testKeysUnder(it) }

    assertEquals(emptyList<String>(), found)
  }

  @Test
  fun `the scan finds a test- key planted in a pin file`() {
    val dir = Files.createTempDirectory("kitbag-pins").toFile().apply { deleteOnExit() }
    File(dir, RULES.keyPinsFile).writeText(TestPins.json(TestPins.tool(TestToolKey.generate("planted"), TestPins.CURRENT)))

    assertEquals(1, testKeysUnder(dir).size)
  }

  private companion object {
    const val CORE_NATIVE_MAIN = "src/main"
    const val APP_MAIN = "../../app-shell/android/app/src/main"
    const val APP_GITHUB = "../../app-shell/android/app/src/github"
  }
}
