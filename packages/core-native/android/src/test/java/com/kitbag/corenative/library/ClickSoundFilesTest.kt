package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ClickSoundFilesTest {
  private val filesDir = File("/data/app/files")

  @Test
  fun resolvesAnAppNameInsideTheClickSoundDir() {
    val name = "3f2a9c10-7b4e-4d1a-9f00-12ab34cd56ef.wav"
    assertEquals(File(File(filesDir, ClickSoundFiles.DIR_NAME), name), ClickSoundFiles.resolve(filesDir, name))
  }

  @Test
  fun refusesAnyNameButAnAppWav() {
    listOf("../db.wav", "a/b.wav", "/abs.wav", ".wav", "a.wav.part", "a.mp3", "", "a b.wav", "..")
      .forEach { assertNull(it, ClickSoundFiles.resolve(filesDir, it)) }
  }

  @Test
  fun refusesAnOverlongName() {
    assertNull(ClickSoundFiles.resolve(filesDir, "${"a".repeat(ClickSoundFiles.MAX_BASE_NAME_CHARS + 1)}.wav"))
  }

  @Test
  fun readsAFullVolumeAsNoSpace() {
    val full = IOException("write failed: ENOSPC (No space left on device)")
    assertTrue(ClickSoundFiles.isNoSpace(full))
    assertTrue(ClickSoundFiles.isNoSpace(IOException("copy failed", full)))
  }

  @Test
  fun readsAnyOtherFailureAsNotNoSpace() {
    assertFalse(ClickSoundFiles.isNoSpace(IOException("read failed: EIO (I/O error)")))
    assertFalse(ClickSoundFiles.isNoSpace(IOException()))
  }
}
