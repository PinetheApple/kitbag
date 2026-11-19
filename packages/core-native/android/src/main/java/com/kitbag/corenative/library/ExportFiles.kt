package com.kitbag.corenative.library

import java.io.File

object ExportFiles {
  const val EXPORT_DIR = "exports"
  const val MAX_BASE_NAME_CHARS = 100
  private const val EXTENSION = ".wav"
  private const val SUBJECT = "file"
  private val UNSAFE_CHARS = Regex("[/\\\\:*?\"<>|\\p{Cntrl}]")

  // Built by the app, re-checked here because it becomes a path.
  fun isSafeFileName(name: String): Boolean {
    val base = name.removeSuffix(EXTENSION)
    return name.endsWith(EXTENSION) &&
      base.isNotBlank() &&
      base.length <= MAX_BASE_NAME_CHARS &&
      !base.startsWith(".") &&
      base.trim() == base &&
      !UNSAFE_CHARS.containsMatchIn(base)
  }

  fun dir(cacheDir: File) = File(cacheDir, EXPORT_DIR)

  // Only a file directly in the exports directory, however the path is spelled.
  fun resolve(cacheDir: File, path: String): File? {
    val file = File(path).canonicalFile
    val inside = file.parentFile == dir(cacheDir).canonicalFile
    return file.takeIf { inside && it.isFile }
  }

  fun clear(cacheDir: File) {
    dir(cacheDir).listFiles()?.forEach { it.delete() }
  }

  fun shareSpec(mime: String) = ShareSpec(mime, chooserTitle = null, subject = SUBJECT)
}
