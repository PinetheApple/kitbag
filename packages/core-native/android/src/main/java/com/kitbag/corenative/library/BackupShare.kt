package com.kitbag.corenative.library

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.io.File

class BackupShare(private val context: ReactApplicationContext, private val files: FileShare) {

  fun share(fileName: String, contents: String, promise: Promise) {
    if (!BackupFiles.isSafeFileName(fileName)) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a backup file name: $fileName")
      return
    }
    files.share(SPEC, promise) { write(fileName, contents) }
  }

  private fun write(fileName: String, contents: String): File {
    val dir = File(context.cacheDir, BackupFiles.SHARE_DIR).apply { mkdirs() }
    return File(dir, fileName).apply { outputStream().use { BackupFiles.write(it, contents) } }
  }

  companion object {
    val SPEC = ShareSpec(BackupFiles.JSON_MIME, chooserTitle = null, subject = "backup")
  }
}
