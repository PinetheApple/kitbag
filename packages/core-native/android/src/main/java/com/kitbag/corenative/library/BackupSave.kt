package com.kitbag.corenative.library

import android.content.Intent
import java.io.File
import java.io.IOException
import java.io.OutputStream

class DatabaseUnsettledException(journal: File) :
  IOException("The database has an unfinished transaction in ${journal.name}")

object BackupSave {
  // "w" does not truncate on some providers; a shorter backup over a longer file would keep its tail.
  const val WRITE_MODE = "wt"

  private val JOURNAL_SUFFIXES = listOf("-journal", "-wal")

  // A hot journal means the main file alone may hold half a transaction.
  fun unsettledJournal(database: File): File? =
    JOURNAL_SUFFIXES.map { File(database.path + it) }.firstOrNull { it.length() > 0 }

  fun dialogExtras(fileName: String): Map<String, String> = mapOf(Intent.EXTRA_TITLE to fileName)

  fun complete(
    saved: Boolean,
    pickedUri: String?,
    contents: String,
    open: (String, String) -> OutputStream?,
    discard: (String) -> Unit,
  ): Boolean = deliver(saved, pickedUri, open, discard) { BackupFiles.write(it, contents) }

  fun copyFile(
    saved: Boolean,
    pickedUri: String?,
    source: File,
    open: (String, String) -> OutputStream?,
    discard: (String) -> Unit,
  ): Boolean {
    val requireSettled: () -> Unit = { unsettledJournal(source)?.let { throw DatabaseUnsettledException(it) } }
    return deliver(saved, pickedUri, open, discard, requireSettled) { out -> source.inputStream().use { it.copyTo(out) } }
  }

  private fun deliver(
    saved: Boolean,
    pickedUri: String?,
    open: (String, String) -> OutputStream?,
    discard: (String) -> Unit,
    beforeOpen: () -> Unit = {},
    write: (OutputStream) -> Unit,
  ): Boolean {
    if (!saved) return false
    val uri = pickedUri ?: throw IOException("The save dialog returned no document")
    try {
      beforeOpen()
      val out = open(uri, WRITE_MODE) ?: throw IOException("Could not open the chosen document")
      out.use(write)
    } catch (e: Exception) {
      runCatching { discard(uri) }.exceptionOrNull()?.let(e::addSuppressed)
      throw e
    }
    return true
  }
}
