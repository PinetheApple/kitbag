package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class ClickSoundFilesWriteTest {
  private val root: File = Files.createTempDirectory("click-sounds").toFile()
  private val wav = byteArrayOf(0x52, 0x49, 0x46, 0x46, 0x00, -0x80, -0x01)

  @After
  fun cleanUp() {
    root.deleteRecursively()
  }

  private fun target(name: String = "3f2a9c10-7b4e-4d1a-9f00-12ab34cd56ef.wav") =
    ClickSoundFiles.resolve(root, name) ?: error("bad name")

  @Test
  fun writesTheBytesIntoTheClickSoundDirAndReadsThemBack() {
    val file = target()
    ClickSoundFiles.write(file, wav)
    assertArrayEquals(wav, file.readBytes())
    assertEquals(listOf(file.name), ClickSoundFiles.dir(root).list()?.toList())
  }

  @Test
  fun replacesAnExistingFileWhole() {
    val file = target()
    ClickSoundFiles.write(file, byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9))
    ClickSoundFiles.write(file, wav)
    assertArrayEquals(wav, file.readBytes())
  }

  @Test
  fun leavesNoPartFileWhenTheMoveFails() {
    val file = target()
    file.mkdirs()
    File(file, "occupied").writeBytes(wav)
    assertThrows(IOException::class.java) { ClickSoundFiles.write(file, wav) }
    assertFalse(File(file.path + ClickSoundFiles.PART_SUFFIX).exists())
  }

  @Test
  fun deletesAFileAndTreatsAMissingOneAsDeleted() {
    val file = target()
    ClickSoundFiles.write(file, wav)
    ClickSoundFiles.delete(file)
    ClickSoundFiles.delete(file)
    assertFalse(file.exists())
  }
}
