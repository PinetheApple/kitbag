package com.kitbag.corenative.library

import java.io.ByteArrayInputStream
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioHeaderTest {
  private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }

  private fun ascii(text: String, vararg tail: Int) =
    text.toByteArray(Charsets.US_ASCII) + bytes(*tail)

  private fun formatOf(header: ByteArray) = AudioHeader.unsupportedFormat(header)

  private val m4a = bytes(0x00, 0x00, 0x00, 0x1C) + ascii("ftypM4A ")

  @Test
  fun namesAnMp4ByItsFtypBox() {
    assertEquals("m4a", formatOf(m4a))
  }

  @Test
  fun namesAnMp4WithAnyBrand() {
    val isom = bytes(0x00, 0x00, 0x00, 0x20) + ascii("ftypisom")
    assertEquals("m4a", formatOf(isom))
  }

  @Test
  fun namesOggByItsCapturePattern() {
    assertEquals("ogg", formatOf(ascii("OggS", 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)))
  }

  @Test
  fun namesAdtsAacWithAndWithoutCrc() {
    assertEquals("aac", formatOf(bytes(0xFF, 0xF1, 0x50, 0x80)))
    assertEquals("aac", formatOf(bytes(0xFF, 0xF0, 0x50, 0x80)))
    assertEquals("aac", formatOf(bytes(0xFF, 0xF9, 0x50, 0x80)))
  }

  @Test
  fun leavesMp3FrameSyncAlone() {
    assertNull(formatOf(bytes(0xFF, 0xFB, 0x90, 0x64)))
    assertNull(formatOf(bytes(0xFF, 0xF3, 0x90, 0x64)))
    assertNull(formatOf(bytes(0xFF, 0xE3, 0x90, 0x64)))
    assertNull(formatOf(bytes(0xFF, 0xFD, 0x90, 0x64)))
  }

  @Test
  fun leavesMp3WithAnId3TagAlone() {
    assertNull(formatOf(ascii("ID3", 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23, 0x54, 0x53)))
  }

  @Test
  fun leavesWavAndFlacAlone() {
    assertNull(formatOf(ascii("RIFF", 0x24, 0x08, 0x00, 0x00) + ascii("WAVE")))
    assertNull(formatOf(ascii("fLaC", 0x00, 0x00, 0x00, 0x22, 0x10, 0x00, 0x10, 0x00)))
  }

  @Test
  fun leavesHeadersTooShortForASignatureAlone() {
    assertNull(formatOf(ByteArray(0)))
    assertNull(formatOf(bytes(0xFF)))
    assertNull(formatOf(ascii("Ogg")))
    assertNull(formatOf(bytes(0x00, 0x00, 0x00, 0x1C) + ascii("fty")))
  }

  @Test
  fun sniffsAnOpenedStream() {
    assertEquals("m4a", AudioHeader.sniff { ByteArrayInputStream(m4a) })
  }

  @Test
  fun leavesAFileThatCannotBeOpenedToTheCopy() {
    assertNull(AudioHeader.sniff { null })
    listOf(
      SecurityException("no grant"),
      IllegalArgumentException("bad uri"),
      IllegalStateException("provider gone"),
      FileNotFoundException("deleted"),
    ).forEach { failure -> assertNull(AudioHeader.sniff { throw failure }) }
  }

  @Test
  fun leavesAStreamThatFailsMidReadToTheCopy() {
    val failing = object : InputStream() {
      override fun read(): Int = throw IOException("read failed")
      override fun read(b: ByteArray, off: Int, len: Int): Int = throw IOException("read failed")
    }
    assertNull(AudioHeader.sniff { failing })
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
    val trickle = object : ByteArrayInputStream(m4a) {
      override fun read(b: ByteArray, off: Int, len: Int) = super.read(b, off, minOf(len, 1))
    }
    assertEquals("m4a", formatOf(AudioHeader.read(trickle)))
  }
}
