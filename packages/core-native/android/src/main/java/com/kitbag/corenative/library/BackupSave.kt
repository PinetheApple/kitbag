package com.kitbag.corenative.library

import android.content.Intent
import java.io.IOException
import java.io.OutputStream

object BackupSave {
  // "w" does not truncate on some providers; a shorter backup over a longer file would keep its tail.
  const val WRITE_MODE = "wt"

  fun dialogExtras(fileName: String): Map<String, String> = mapOf(Intent.EXTRA_TITLE to fileName)

  fun complete(
    saved: Boolean,
    pickedUri: String?,
    contents: String,
    open: (String, String) -> OutputStream?,
    discard: (String) -> Unit,
  ): Boolean {
    if (!saved) return false
    val uri = pickedUri ?: throw IOException("The save dialog returned no document")
    try {
      val out = open(uri, WRITE_MODE) ?: throw IOException("Could not open the chosen document")
      out.use { BackupFiles.write(it, contents) }
    } catch (e: Exception) {
      runCatching { discard(uri) }.exceptionOrNull()?.let(e::addSuppressed)
      throw e
    }
    return true
  }
}
