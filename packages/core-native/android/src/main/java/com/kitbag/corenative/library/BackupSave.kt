package com.kitbag.corenative.library

import android.content.Intent
import java.io.IOException
import java.io.OutputStream

object BackupSave {
  fun dialogExtras(fileName: String): Map<String, String> = mapOf(Intent.EXTRA_TITLE to fileName)

  fun complete(saved: Boolean, pickedUri: String?, contents: String, open: (String) -> OutputStream?): Boolean {
    if (!saved) return false
    val uri = pickedUri ?: throw IOException("The save dialog returned no document")
    val out = open(uri) ?: throw IOException("Could not open the chosen document")
    out.use { BackupFiles.write(it, contents) }
    return true
  }
}
