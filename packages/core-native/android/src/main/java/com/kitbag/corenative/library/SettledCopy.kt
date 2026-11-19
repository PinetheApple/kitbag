package com.kitbag.corenative.library

import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream

class DatabaseCopyNoSpaceException(cause: Throwable? = null) :
  IOException("Not enough free space for a private copy of the database", cause)

class DatabaseCopyUnreadableException(cause: Throwable? = null) :
  IOException("The private copy of the database could not be recovered", cause)

fun interface DatabaseRecovery {
  fun recover(database: File)
}

class SettledCopy(
  private val workDir: File,
  private val recovery: DatabaseRecovery,
  private val usableSpace: (File) -> Long = File::getUsableSpace,
  private val copyFile: (File, File) -> Unit = { from, to -> from.copyTo(to) },
) {
  fun <T> read(database: File, consume: (InputStream) -> T): T {
    clear()
    if (unsettledJournal(database) == null) return database.inputStream().use(consume)
    try {
      return recovered(database).inputStream().use(consume)
    } finally {
      clear()
    }
  }

  private fun clear() {
    workDir.deleteRecursively()
  }

  private fun recovered(database: File): File {
    if (!database.isFile) throw FileNotFoundException("No database file ${database.name}")
    val sources = listOf(database) + COMPANION_SUFFIXES.map { File(database.path + it) }.filter { it.isFile }
    if (!workDir.mkdirs()) throw IOException("Could not create ${workDir.name}")
    if (usableSpace(workDir) < sources.sumOf { it.length() } * RECOVERY_SPACE_FACTOR) {
      throw DatabaseCopyNoSpaceException()
    }
    sources.forEach { source ->
      try {
        copyFile(source, File(workDir, source.name))
      } catch (e: IOException) {
        if (outOfSpace(e, source.length())) throw DatabaseCopyNoSpaceException(e)
        throw e
      }
    }
    val copy = File(workDir, database.name)
    try {
      recovery.recover(copy)
    } catch (e: DatabaseCopyNoSpaceException) {
      throw e
    } catch (e: Exception) {
      throw DatabaseCopyUnreadableException(e)
    }
    if (unsettledJournal(copy) != null) throw DatabaseCopyUnreadableException()
    return copy
  }

  private fun outOfSpace(error: IOException, sourceBytes: Long): Boolean =
    usableSpace(workDir) < sourceBytes ||
      generateSequence<Throwable>(error) { it.cause }.any { cause -> NO_SPACE_MARKERS.any { cause.message.orEmpty().contains(it) } }

  companion object {
    const val WORK_DIR = "database-copy"

    private val JOURNAL_SUFFIXES = listOf("-journal", "-wal")
    private val COMPANION_SUFFIXES = JOURNAL_SUFFIXES + "-shm"

    // A WAL checkpoint can grow the main file by up to the log's size while both still exist.
    internal const val RECOVERY_SPACE_FACTOR = 2L

    private val NO_SPACE_MARKERS = listOf("ENOSPC", "No space left on device")

    // A hot journal means the main file alone may hold half a transaction.
    fun unsettledJournal(database: File): File? =
      JOURNAL_SUFFIXES.map { File(database.path + it) }.firstOrNull { it.length() > 0 }
  }
}
