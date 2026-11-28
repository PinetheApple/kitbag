package com.kitbag.corenative.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class InstalledToolLoaderTest {
  private class HandedOff(val toolId: String, val bytecode: ByteArray, val bytecodeVersion: Int)

  private class RecordingHandOff : BytecodeHandOff {
    val handedOff = mutableListOf<HandedOff>()
    val dropped = mutableListOf<String>()
    var refusal: RuntimeException? = null

    override fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int) {
      refusal?.let { throw it }
      handedOff += HandedOff(toolId, bytecode, bytecodeVersion)
    }

    override fun drop(toolId: String): Boolean {
      dropped += toolId
      return true
    }
  }

  private val root: File = Files.createTempDirectory("kitbag-tools").toFile().apply { deleteOnExit() }
  private val installed = InstalledTools(root, RULES)
  private val key = TestToolKey.generate("loader")
  private val native = RecordingHandOff()
  private val loader = InstalledToolLoader(installed, RULES, { TestPins.ring(TestPins.tool(key, TestPins.RETIRED)) }, native)

  private fun install(kbt: ByteArray) {
    installed.kbtFile(TestTool.ID).apply { parentFile!!.mkdirs() }.writeBytes(kbt)
  }

  private fun tampered(): ByteArray {
    val bytes = TestTool.manifest(key.keyId).toString().toByteArray()
    val swapped = listOf(ZipItem(RULES.entryFile, "swapped".toByteArray()), TestTool.files()[1])
    return TestTool.kbt(bytes, key.sign(bytes), swapped)
  }

  @Test
  fun `a verified installed tool hands its bytecode and manifest version to native once`() {
    install(TestTool.signed(key))

    loader.load(TestTool.ID)

    assertEquals(1, native.handedOff.size)
    assertEquals(TestTool.ID, native.handedOff[0].toolId)
    assertArrayEquals(TestTool.BYTECODE, native.handedOff[0].bytecode)
    assertEquals(TestTool.BYTECODE_VERSION, native.handedOff[0].bytecodeVersion)
    assertTrue(native.dropped.isEmpty())
  }

  @Test
  fun `a tool that is not installed hands nothing off and drops any earlier bundle`() {
    assertEquals(ToolRejection.NOT_INSTALLED, rejectedWith { loader.load(TestTool.ID) }?.rejection)
    assertTrue(native.handedOff.isEmpty())
    assertEquals(listOf(TestTool.ID), native.dropped)
  }

  @Test
  fun `an id that is not a tool id never becomes a path`() {
    for (id in listOf("../sample", "sample/../../x", "", "Sample")) {
      assertEquals(id, ToolRejection.BAD_ID, rejectedWith { loader.load(id) }?.rejection)
    }
    assertTrue(native.handedOff.isEmpty())
    assertTrue(native.dropped.isEmpty())
  }

  @Test
  fun `a tampered installed tool hands nothing off and drops any earlier bundle`() {
    install(tampered())

    assertEquals(ToolRejection.FILES, rejectedWith { loader.load(TestTool.ID) }?.rejection)
    assertTrue(native.handedOff.isEmpty())
    assertEquals(listOf(TestTool.ID), native.dropped)
  }

  @Test
  fun `a native refusal of the bytes is a handoff failure, not a verifier one`() {
    install(TestTool.signed(key))
    native.refusal = IllegalStateException("too many tools awaiting evaluation")

    assertEquals(ToolRejection.HANDOFF, rejectedWith { loader.load(TestTool.ID) }?.rejection)
    assertEquals(listOf(TestTool.ID), native.dropped)
  }
}
