package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import java.nio.file.Files
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class SettledCopyTest {
  private val root = Files.createTempDirectory("kitbag-settled").toFile().apply { deleteOnExit() }
  private val live = File(root, "databases").apply { mkdirs() }
  private val database = File(live, NAME).apply { writeBytes(TORN) }
  private val workDir = File(root, SettledCopy.WORK_DIR)
  private val recovered = mutableListOf<File>()
  private val seenBeside = mutableMapOf<String, ByteArray>()
  private var staleSeen = false

  private val rollBack = DatabaseRecovery { copy ->
    recovered += copy
    COMPANIONS
      .map { File(copy.path + it) }
      .filter { it.exists() }
      .forEach { seenBeside[it.name.removePrefix(NAME)] = it.readBytes() }
    staleSeen = File(copy.parentFile, STALE_NAME).exists()
    copy.writeBytes(COMMITTED)
    COMPANIONS.forEach { File(copy.path + it).delete() }
  }

  private fun settled(recovery: DatabaseRecovery = rollBack, free: Long = Long.MAX_VALUE) =
    SettledCopy(workDir, recovery, usableSpace = { free })

  private fun failingCopy(error: IOException, free: () -> Long = { Long.MAX_VALUE }) =
    SettledCopy(workDir, rollBack, usableSpace = { free() }, copyFile = { _, _ -> throw error })

  private fun beside(suffix: String, bytes: ByteArray = JOURNAL) = File(database.path + suffix).apply { writeBytes(bytes) }

  private fun readAll(copy: SettledCopy = settled()): ByteArray = copy.read(database) { it.readBytes() }

  @Test
  fun `a database with no unfinished journal is read as it is, without opening it`() {
    beside(JOURNAL_SUFFIX, ByteArray(0))

    assertArrayEquals(TORN, readAll())

    assertTrue(recovered.isEmpty())
  }

  @Test
  fun `a hot rollback journal is recovered in a private copy under the same name and only committed data is read`() {
    beside(JOURNAL_SUFFIX)

    assertArrayEquals(COMMITTED, readAll())

    assertEquals(listOf(File(workDir, NAME)), recovered)
    assertArrayEquals(JOURNAL, seenBeside[JOURNAL_SUFFIX])
  }

  @Test
  fun `a write-ahead log is recovered with its shared-memory file beside it`() {
    beside(WAL_SUFFIX)
    beside(SHM_SUFFIX, SHM)

    assertArrayEquals(COMMITTED, readAll())

    assertArrayEquals(JOURNAL, seenBeside[WAL_SUFFIX])
    assertArrayEquals(SHM, seenBeside[SHM_SUFFIX])
  }

  @Test
  fun `the live database and its journals are never opened or changed`() {
    val liveFiles = listOf(database, beside(WAL_SUFFIX), beside(SHM_SUFFIX, SHM), beside(JOURNAL_SUFFIX))
    liveFiles.forEach { it.setLastModified(LIVE_MTIME) }
    val before = liveFiles.map { it.readBytes() }

    readAll()

    assertTrue(recovered.none { it.parentFile?.canonicalFile == live.canonicalFile })
    assertEquals(before.map { it.toList() }, liveFiles.map { it.readBytes().toList() })
    assertEquals(liveFiles.map { LIVE_MTIME }, liveFiles.map { it.lastModified() })
  }

  @Test
  fun `a copy left by a killed run is cleared before recovering`() {
    workDir.mkdirs()
    File(workDir, STALE_NAME).writeBytes(JOURNAL)
    File(workDir, NAME + JOURNAL_SUFFIX).writeBytes(SHM)
    beside(JOURNAL_SUFFIX)

    assertArrayEquals(COMMITTED, readAll())

    assertFalse(staleSeen)
    assertArrayEquals(JOURNAL, seenBeside[JOURNAL_SUFFIX])
  }

  @Test
  fun `a copy left by a killed run is cleared even when no recovery is needed`() {
    workDir.mkdirs()
    File(workDir, STALE_NAME).writeBytes(JOURNAL)

    readAll()

    assertFalse(workDir.exists())
  }

  @Test
  fun `the private copy is gone after a successful read`() {
    beside(JOURNAL_SUFFIX)

    readAll()

    assertFalse(workDir.exists())
  }

  @Test
  fun `a copy that will not open is unreadable and leaves nothing behind`() {
    beside(JOURNAL_SUFFIX)
    val corrupt = DatabaseRecovery { throw IllegalStateException("file is not a database") }

    assertThrows(DatabaseCopyUnreadableException::class.java) { readAll(settled(corrupt)) }

    assertFalse(workDir.exists())
  }

  @Test
  fun `a copy whose journal is still hot after recovery is unreadable and leaves nothing behind`() {
    beside(JOURNAL_SUFFIX)

    assertThrows(DatabaseCopyUnreadableException::class.java) { readAll(settled(DatabaseRecovery { recovered += it })) }

    assertFalse(workDir.exists())
  }

  @Test
  fun `a failure while reading the recovered copy still clears it`() {
    beside(JOURNAL_SUFFIX)

    assertThrows(IOException::class.java) { settled().read(database) { throw IOException("disk full") } }

    assertFalse(workDir.exists())
  }

  @Test
  fun `too little free space for the copy refuses before copying anything`() {
    beside(WAL_SUFFIX)
    val needed = (TORN.size + JOURNAL.size).toLong() * SettledCopy.RECOVERY_SPACE_FACTOR

    assertThrows(DatabaseCopyNoSpaceException::class.java) { readAll(settled(free = needed - 1)) }

    assertTrue(recovered.isEmpty())
    assertFalse(workDir.exists())
    assertArrayEquals(COMMITTED, readAll(settled(free = needed)))
  }

  @Test
  fun `running out of space while copying into the cache reports no space and leaves nothing behind`() {
    beside(JOURNAL_SUFFIX)
    val errors = listOf(
      IOException("write failed: ENOSPC (No space left on device)"),
      IOException("copy failed", IOException("No space left on device")),
    )

    for (error in errors) {
      assertThrows("$error", DatabaseCopyNoSpaceException::class.java) { readAll(failingCopy(error)) }
      assertFalse(workDir.exists())
    }
    assertTrue(recovered.isEmpty())
  }

  @Test
  fun `a copy failure with free space gone by then reports no space`() {
    beside(JOURNAL_SUFFIX)
    val checks = mutableListOf(Long.MAX_VALUE, 0L)

    assertThrows(DatabaseCopyNoSpaceException::class.java) {
      readAll(failingCopy(IOException("I/O error")) { checks.removeAt(0) })
    }
  }

  @Test
  fun `any other copy failure keeps its own error`() {
    beside(JOURNAL_SUFFIX)
    val error = IOException("I/O error")

    val thrown = assertThrows(IOException::class.java) { readAll(failingCopy(error)) }

    assertEquals(error, thrown)
    assertFalse(workDir.exists())
  }

  @Test
  fun `running out of space during recovery reports no space, not unreadable`() {
    beside(JOURNAL_SUFFIX)
    val full = DatabaseRecovery { throw DatabaseCopyNoSpaceException() }

    assertThrows(DatabaseCopyNoSpaceException::class.java) { readAll(settled(full)) }

    assertFalse(workDir.exists())
  }

  @Test
  fun `a missing database fails without recovering`() {
    beside(JOURNAL_SUFFIX)
    database.delete()

    assertThrows(IOException::class.java) { readAll() }

    assertTrue(recovered.isEmpty())
  }

  @Test
  fun `only a journal or write-ahead log with bytes in it marks the database unsettled`() {
    assertNull(SettledCopy.unsettledJournal(database))

    val wal = beside(WAL_SUFFIX, ByteArray(0))
    beside(SHM_SUFFIX, SHM)
    assertNull(SettledCopy.unsettledJournal(database))

    wal.writeBytes(JOURNAL)
    assertEquals(wal, SettledCopy.unsettledJournal(database))
  }

  private companion object {
    const val NAME = "kitbag"
    const val JOURNAL_SUFFIX = "-journal"
    const val WAL_SUFFIX = "-wal"
    const val SHM_SUFFIX = "-shm"
    const val STALE_NAME = "kitbag-stale"
    const val LIVE_MTIME = 1_700_000_000_000L
    val COMPANIONS = listOf(JOURNAL_SUFFIX, WAL_SUFFIX, SHM_SUFFIX)
    val TORN = "SQLite format 3\u0000torn".toByteArray(Charsets.US_ASCII)
    val COMMITTED = "SQLite format 3\u0000committed".toByteArray(Charsets.US_ASCII)
    val JOURNAL = byteArrayOf(-39, -43, 5, -7, 32, -95, 99, -41)
    val SHM = byteArrayOf(1, 2, 3)
  }
}
