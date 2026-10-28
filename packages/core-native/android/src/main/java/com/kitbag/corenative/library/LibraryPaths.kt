package com.kitbag.corenative.library

import java.io.File

class UnsafeLibraryPathException(path: String) :
  IllegalArgumentException("Path escapes the library: \"$path\"")

object LibraryPaths {
  private const val FALLBACK_STEM = "audio"
  const val SONGS_DIR_NAME = "songs"
  const val STEMS_DIR_NAME = "stems"

  // ext4 caps a name at 255 bytes and a letter can take 4 in UTF-8; this
  // leaves room for the collision suffix and a ".part" or ".kwav" sibling.
  private const val MAX_STEM_CHARS = 48
  private const val MAX_EXTENSION_CHARS = 8

  fun resolve(base: File, relativePath: String, allowBase: Boolean = false): File {
    if (relativePath.startsWith("/") || relativePath.split('/').any { it == ".." }) {
      throw UnsafeLibraryPathException(relativePath)
    }
    val segments = relativePath.split('/').filter { it.isNotEmpty() && it != "." }
    if (segments.isEmpty() && !allowBase) throw UnsafeLibraryPathException(relativePath)

    val root = base.canonicalFile
    val target = segments.fold(root) { dir, segment -> File(dir, segment) }.canonicalFile
    if (target != root && !target.path.startsWith(root.path + File.separator)) {
      throw UnsafeLibraryPathException(relativePath)
    }
    return target
  }

  fun requireInsideLibrary(base: File, relativePath: String, allowBase: Boolean = false) {
    resolve(base, relativePath, allowBase)
  }

  fun relativize(base: File, file: File): String =
    file.canonicalFile.relativeTo(base.canonicalFile).invariantSeparatorsPath

  fun safeFileName(displayName: String?, fallbackExtension: String?): String {
    val leaf = displayName.orEmpty().substringAfterLast('/')
    val dot = leaf.lastIndexOf('.')
    val rawStem = if (dot > 0) leaf.substring(0, dot) else leaf
    val rawExtension = if (dot > 0) leaf.substring(dot + 1) else fallbackExtension.orEmpty()

    val stem = rawStem
      .map { if (it.isLetterOrDigit() || it in " -_()") it else '_' }
      .joinToString("")
      .trim()
      .trimStart('_')
      .take(MAX_STEM_CHARS)
      .trimEnd()
      .ifEmpty { FALLBACK_STEM }
    val extension = rawExtension
      .filter { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' }
      .take(MAX_EXTENSION_CHARS)
      .lowercase()
    return if (extension.isEmpty()) stem else "$stem.$extension"
  }

  // Unique by stem, not full name: the waveform sidecar is keyed on the stem,
  // so "a.mp3" and "a.flac" in one directory would share one ".kwav".
  fun uniqueFileName(safeName: String, takenNames: Collection<String>): String {
    val takenStems = takenNames.mapTo(HashSet()) { stemOf(it).lowercase() }
    val stem = stemOf(safeName)
    val suffix = safeName.substring(stem.length)
    if (stem.lowercase() !in takenStems) return safeName
    var n = 2
    while ("$stem-$n".lowercase() in takenStems) n++
    return "$stem-$n$suffix"
  }

  fun songFolder(base: File, folderName: String): File = childFolder(base, SONGS_DIR_NAME, folderName)

  fun stemFolder(base: File, folderName: String): File = childFolder(base, STEMS_DIR_NAME, folderName)

  private fun childFolder(base: File, parent: String, folderName: String): File {
    if (folderName.isEmpty() || '/' in folderName || folderName.startsWith('.')) {
      throw UnsafeLibraryPathException(folderName)
    }
    return resolve(base, "$parent/$folderName")
  }

  private fun stemOf(name: String): String {
    val dot = name.lastIndexOf('.')
    return if (dot > 0) name.substring(0, dot) else name
  }
}
