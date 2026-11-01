package com.kitbag.corenative.library

import java.io.ByteArrayInputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupFilesTest {
  @Test
  fun readsAFileAtTheCap() {
    val bytes = ByteArray(10) { it.toByte() }
    assertArrayEquals(bytes, BackupFiles.readCapped(ByteArrayInputStream(bytes), maxBytes = 10))
  }

  @Test
  fun refusesAFileOverTheCap() {
    assertThrows(BackupTooLargeException::class.java) {
      BackupFiles.readCapped(ByteArrayInputStream(ByteArray(11)), maxBytes = 10)
    }
  }

  @Test
  fun acceptsPlainJsonFileNames() {
    assertTrue(BackupFiles.isSafeFileName("kitbag_export.json"))
    assertTrue(BackupFiles.isSafeFileName("kitbag_setlist_wedding-set.json"))
  }

  @Test
  fun refusesPathsAndOtherExtensions() {
    assertFalse(BackupFiles.isSafeFileName("../kitbag.json"))
    assertFalse(BackupFiles.isSafeFileName("a/b.json"))
    assertFalse(BackupFiles.isSafeFileName(".json"))
    assertFalse(BackupFiles.isSafeFileName("kitbag.txt"))
  }
}
