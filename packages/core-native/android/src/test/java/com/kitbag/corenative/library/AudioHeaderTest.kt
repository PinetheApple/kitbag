package com.kitbag.corenative.library

import java.io.ByteArrayInputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioHeaderTest {
  private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }

  private fun ascii(text: String, vararg tail: Int) =
    text.toByteArray(Charsets.US_ASCII) + bytes(*tail)

  private fun sniff(header: ByteArray) = AudioHeader.unsupportedFormat(header)

  @Test
  fun namesAnMp4ByItsFtypBox() {
    val m4a = bytes(0x00, 0x00, 0x00, 0x1C) + ascii("ftypM4A ")
    assertEquals("m4a", sniff(m4a))
  }

  @Test
  fun namesAnMp4WithAnyBrand() {
    val isom = bytes(0x00, 0x00, 0x00, 0x20) + ascii("ftypisom")
    assertEquals("m4a", sniff(isom))
  }

  @Test
  fun namesOggByItsCapturePattern() {
    assertEquals("ogg", sniff(ascii("OggS", 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)))
  }

  @Test
  fun namesAdtsAacWithAndWithoutCrc() {
    assertEquals("aac", sniff(bytes(0xFF, 0xF1, 0x50, 0x80)))
    assertEquals("aac", sniff(bytes(0xFF, 0xF0, 0x50, 0x80)))
    assertEquals("aac", sniff(bytes(0xFF, 0xF9, 0x50, 0x80)))
  }

  @Test
  fun leavesMp3FrameSyncAlone() {
    assertNull(sniff(bytes(0xFF, 0xFB, 0x90, 0x64)))
    assertNull(sniff(bytes(0xFF, 0xF3, 0x90, 0x64)))
    assertNull(sniff(bytes(0xFF, 0xE3, 0x90, 0x64)))
    assertNull(sniff(bytes(0xFF, 0xFD, 0x90, 0x64)))
  }

  @Test
  fun leavesMp3WithAnId3TagAlone() {
    assertNull(sniff(ascii("ID3", 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23, 0x54, 0x53)))
  }

  @Test
  fun leavesWavAndFlacAlone() {
    assertNull(sniff(ascii("RIFF", 0x24, 0x08, 0x00, 0x00) + ascii("WAVE")))
    assertNull(sniff(ascii("fLaC", 0x00, 0x00, 0x00, 0x22, 0x10, 0x00, 0x10, 0x00)))
  }

  @Test
  fun leavesHeadersTooShortForASignatureAlone() {
    assertNull(sniff(ByteArray(0)))
    assertNull(sniff(bytes(0xFF)))
    assertNull(sniff(ascii("Ogg")))
    assertNull(sniff(bytes(0x00, 0x00, 0x00, 0x1C) + ascii("fty")))
  }

  @Test
  fun readsAtMostTheHeaderSize() {
    val file = ByteArray(AudioHeader.SIZE * 2) { it.toByte() }
    assertArrayEquals(file.copyOf(AudioHeader.SIZE), AudioHeader.read(ByteArrayInputStream(file)))
  }

  @Test
  fun readsAShortFileWhole() {
    assertArrayEquals(ascii("OggS"), AudioHeader.read(ByteArrayInputStream(ascii("OggS"))))
  }

  @Test
  fun fillsTheHeaderAcrossShortReads() {
    val file = bytes(0x00, 0x00, 0x00, 0x1C) + ascii("ftypM4A ")
    val trickle = object : ByteArrayInputStream(file) {
      override fun read(b: ByteArray, off: Int, len: Int) = super.read(b, off, minOf(len, 1))
    }
    assertEquals("m4a", sniff(AudioHeader.read(trickle)))
  }
}
