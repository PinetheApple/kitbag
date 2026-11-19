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

  @Test
  fun acceptsTheDatabaseNameAndADatedCopyName() {
    assertTrue(BackupFiles.isSafeDatabaseName("kitbag"))
    assertTrue(BackupFiles.isSafeCopyName("Kitbag data 2026-11-19.db"))
  }

  @Test
  fun refusesDatabasePathsAndCopiesWithoutTheDbExtension() {
    assertFalse(BackupFiles.isSafeDatabaseName("../kitbag"))
    assertFalse(BackupFiles.isSafeDatabaseName("databases/kitbag"))
    assertFalse(BackupFiles.isSafeCopyName("../Kitbag data.db"))
    assertFalse(BackupFiles.isSafeCopyName("Kitbag data.json"))
    assertFalse(BackupFiles.isSafeCopyName(" leading space.db"))
  }
}
