package com.kitbag.corenative.library

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

class BackupTooLargeException : IOException("The picked file is too large to be a backup")

object BackupFiles {
  const val MAX_BACKUP_BYTES = 16 * 1024 * 1024
  const val SHARE_DIR = "backups"
  const val JSON_MIME = "application/json"
  const val DATABASE_MIME = "application/octet-stream"

  private const val BUFFER_BYTES = 64 * 1024
  private val SAFE_FILE_NAME = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\\.json$")
  private val SAFE_DATABASE_NAME = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
  private val SAFE_COPY_NAME = Regex("^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}\\.db$")

  fun isSafeFileName(name: String): Boolean = SAFE_FILE_NAME.matches(name)

  fun isSafeDatabaseName(name: String): Boolean = SAFE_DATABASE_NAME.matches(name)

  fun isSafeCopyName(name: String): Boolean = SAFE_COPY_NAME.matches(name)

  fun write(out: OutputStream, contents: String) = out.write(contents.toByteArray(Charsets.UTF_8))

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
