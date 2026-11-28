package com.kitbag.corenative.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ToolZipTest {
  private val data = "the same bytes, many times over. ".repeat(64).toByteArray()
  private val item = ZipItem(RULES.entryFile, data)

  private fun rejected(zip: ByteArray) = rejectedWith { ToolZip.read(zip, RULES.inflatedMaxBytes) }?.rejection

  private fun rejectedFor(zip: ByteArray, reason: String) {
    val message = rejectedWith { ToolZip.read(zip, RULES.inflatedMaxBytes) }?.message
    assertTrue("$message", message?.contains(reason) == true)
  }

  @Test
  fun `reads back every entry it was given`() {
    val other = ZipItem(TestTool.ASSET, TestTool.ASSET_DATA)
    val entries = ToolZip.read(TestZip.write(listOf(item, other)), RULES.inflatedMaxBytes)

    assertEquals(listOf(item.name, other.name), entries.map { it.name })
    assertArrayEquals(data, entries[0].data)
    assertArrayEquals(TestTool.ASSET_DATA, entries[1].data)
  }

  @Test
  fun `an empty entry reads back empty`() {
    val entries = ToolZip.read(TestZip.write(listOf(ZipItem(TestTool.ASSET, ByteArray(0)))), RULES.inflatedMaxBytes)

    assertEquals(0, entries.single().data.size)
  }

  @Test
  fun `an entry whose CRC does not match is rejected`() {
    assertEquals(ToolRejection.ZIP, rejected(TestZip.write(listOf(ZipItem(item.name, data, crc = item.crc xor 1)))))
  }

  @Test
  fun `local and central headers that disagree are rejected`() {
    assertEquals(ToolRejection.ZIP, rejected(TestZip.write(listOf(ZipItem(item.name, data, localName = TestTool.ASSET)))))
  }

  @Test
  fun `a zip bomb declaring more than the inflated cap is rejected before inflating`() {
    val bomb = ZipItem(item.name, data, declaredSize = RULES.inflatedMaxBytes + 1)

    rejectedFor(TestZip.write(listOf(bomb)), "over ${RULES.inflatedMaxBytes}")
  }

  @Test
  fun `an entry that inflates past its declared size is rejected`() {
    rejectedFor(TestZip.write(listOf(ZipItem(item.name, data, declaredSize = data.size - 1L))), "past its declared size")
  }

  @Test
  fun `an entry that inflates short of its declared size is rejected`() {
    rejectedFor(TestZip.write(listOf(ZipItem(item.name, data, declaredSize = data.size + 1L))), "short of its declared size")
  }

  @Test
  fun `two directory entries over the same bytes are rejected as overlapping`() {
    assertEquals(ToolRejection.ZIP, rejected(TestZip.write(listOf(item), centralOrder = listOf(0, 0))))
  }

  @Test
  fun `a truncated or foreign archive is rejected`() {
    val zip = TestZip.write(listOf(item))

    assertEquals(ToolRejection.ZIP, rejected(zip.copyOf(zip.size - 1)))
    assertEquals(ToolRejection.ZIP, rejected(ByteArray(0)))
    assertEquals(ToolRejection.ZIP, rejected(data))
  }
}
