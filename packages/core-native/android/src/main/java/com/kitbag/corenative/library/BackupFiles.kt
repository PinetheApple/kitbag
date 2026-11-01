package com.kitbag.corenative.library

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream

class BackupTooLargeException : IOException("The picked file is too large to be a backup")

object BackupFiles {
  const val MAX_BACKUP_BYTES = 64 * 1024 * 1024
  const val SHARE_DIR = "backups"
  const val JSON_MIME = "application/json"

  private const val BUFFER_BYTES = 64 * 1024
  private val SAFE_FILE_NAME = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\\.json$")

  fun isSafeFileName(name: String): Boolean = SAFE_FILE_NAME.matches(name)

  fun readCapped(input: InputStream, maxBytes: Int = MAX_BACKUP_BYTES): ByteArray {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(BUFFER_BYTES)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) return out.toByteArray()
      if (out.size() + read > maxBytes) throw BackupTooLargeException()
      out.write(buffer, 0, read)
    }
  }
}
