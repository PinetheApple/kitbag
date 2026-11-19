package com.kitbag.corenative.library

import java.io.File

object ExportFiles {
  const val EXPORT_DIR = "exports"
  const val WAV_MIME = "audio/wav"
  private const val EXTENSION = ".wav"

  // WavWriter::kPartSuffix in native: the render writes name + this first.
  private const val PART_SUFFIX = ".part"
  private const val NAME_MAX_BYTES = 255
  val MAX_BASE_NAME_BYTES = NAME_MAX_BYTES - utf8Bytes(EXTENSION + PART_SUFFIX)
  private const val SUBJECT = "file"
  private val UNSAFE_CHARS = Regex("[/\\\\:*?\"<>|\\p{Cntrl}]")

  // The app builds the name; it is re-checked here because it becomes a path.
  fun exportName(fileName: String): String? {
    if (!fileName.endsWith(EXTENSION)) return null
    val base = trimToBytes(fileName.removeSuffix(EXTENSION), MAX_BASE_NAME_BYTES).trimEnd()
    val safe = base.isNotBlank() &&
      !base.startsWith(".") &&
      base.trimStart() == base &&
      !UNSAFE_CHARS.containsMatchIn(base)
    return if (safe) base + EXTENSION else null
  }

  fun dir(cacheDir: File) = File(cacheDir, EXPORT_DIR)

  fun resolve(cacheDir: File, path: String): File? {
    val file = File(path).canonicalFile
    val inside = file.parentFile == dir(cacheDir).canonicalFile
    return file.takeIf { inside && it.isFile }
  }

  fun clear(cacheDir: File) {
    dir(cacheDir).listFiles()?.forEach { it.delete() }
  }

  fun shareSpec() = ShareSpec(WAV_MIME, chooserTitle = null, subject = SUBJECT)

  private fun utf8Bytes(text: String) = text.toByteArray(Charsets.UTF_8).size

  private fun trimToBytes(text: String, maxBytes: Int): String {
    val out = StringBuilder()
    var bytes = 0
    var index = 0
    while (index < text.length) {
      val codePoint = text.codePointAt(index)
      val chars = String(Character.toChars(codePoint))
      bytes += utf8Bytes(chars)
      if (bytes > maxBytes) break
      out.append(chars)
      index += Character.charCount(codePoint)
    }
    return out.toString()
  }
}
