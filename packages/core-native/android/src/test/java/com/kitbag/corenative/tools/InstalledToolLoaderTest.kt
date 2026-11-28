package com.kitbag.corenative.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class InstalledToolLoaderTest {
  private class HandOff(val toolId: String, val bytecode: ByteArray, val bytecodeVersion: Int)

  private val root: File = Files.createTempDirectory("kitbag-tools").toFile().apply { deleteOnExit() }
  private val installed = InstalledTools(root, RULES)
  private val key = TestToolKey.generate("loader")
  private val handOffs = mutableListOf<HandOff>()
  private val loader = InstalledToolLoader(
    installed,
    RULES,
    { TestPins.ring(TestPins.tool(key, TestPins.RETIRED)) },
  ) { id, bytes, version -> handOffs += HandOff(id, bytes, version) }

  private fun install(kbt: ByteArray) {
    installed.kbtFile(TestTool.ID).apply { parentFile!!.mkdirs() }.writeBytes(kbt)
  }

  @Test
  fun `a verified installed tool hands its bytecode and manifest version to native once`() {
    install(TestTool.signed(key))

    loader.load(TestTool.ID)

    assertEquals(1, handOffs.size)
    assertEquals(TestTool.ID, handOffs[0].toolId)
    assertArrayEquals(TestTool.BYTECODE, handOffs[0].bytecode)
    assertEquals(TestTool.BYTECODE_VERSION, handOffs[0].bytecodeVersion)
  }

  @Test
  fun `a tool that is not installed hands nothing off`() {
    assertEquals(ToolRejection.NOT_INSTALLED, rejection { loader.load(TestTool.ID) })
    assertTrue(handOffs.isEmpty())
  }

  @Test
  fun `an id that is not a tool id never becomes a path`() {
    for (id in listOf("../sample", "sample/../../x", "", "Sample")) {
      assertEquals(id, ToolRejection.BAD_ID, rejection { loader.load(id) })
    }
    assertTrue(handOffs.isEmpty())
  }

  @Test
  fun `a tampered installed tool hands nothing off`() {
    val bytes = TestTool.manifest(key.keyId).toString().toByteArray()
    val otherBytecode = listOf(ZipItem(RULES.entryFile, "swapped".toByteArray()), TestTool.files()[1])
    install(TestTool.kbt(bytes, key.sign(bytes), otherBytecode))

    assertEquals(ToolRejection.FILES, rejection { loader.load(TestTool.ID) })
    assertTrue(handOffs.isEmpty())
  }
}
