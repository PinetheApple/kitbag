package com.kitbag.corenative.library

import java.io.File

data class FileTally(val files: Int, val bytes: Long)

data class StorageUsage(
  val libraryAudio: FileTally,
  val stemSets: Int,
  val stemBytes: Long,
  val databaseBytes: Long,
)

object LibraryUsage {
  private val SQLITE_SIDE_SUFFIXES = listOf("-wal", "-shm", "-journal")

  fun measure(base: File, database: File): StorageUsage {
    val songs = Tally()
    val stems = Tally()
    var stemSets = 0
    forEachEntry(base.canonicalFile) { entry ->
      when (entry.name) {
        LibraryPaths.SONGS_DIR_NAME -> walk(entry, songs)
        LibraryPaths.STEMS_DIR_NAME -> forEachEntry(entry) { child ->
          if (child.isDirectory && !LibraryPaths.isHiddenName(child.name)) stemSets++
          visit(child, stems)
        }
        else -> visit(entry, songs)
      }
    }
    return StorageUsage(FileTally(songs.files, songs.bytes), stemSets, stems.bytes, databaseBytes(database))
  }

  fun missing(base: File, relativePaths: Sequence<String>): Sequence<String> =
    relativePaths.filterNot { isLibraryFile(base, it) }

  private fun isLibraryFile(base: File, relativePath: String): Boolean =
    try {
      LibraryPaths.resolve(base, relativePath).isFile
    } catch (e: UnsafeLibraryPathException) {
      false
    }

  private fun databaseBytes(database: File): Long {
    val dir = database.absoluteFile.parentFile?.canonicalFile ?: return 0
    return (listOf(database.name) + SQLITE_SIDE_SUFFIXES.map { database.name + it })
      .map { File(dir, it) }
      .filter { !isSymlink(it) && it.isFile }
      .sumOf { it.length() }
  }

  private class Tally {
    var files = 0
    var bytes = 0L
  }

  private fun walk(dir: File, tally: Tally) = forEachEntry(dir) { visit(it, tally) }

  private fun visit(entry: File, tally: Tally) {
    when {
      entry.isFile -> {
        tally.files++
        tally.bytes += entry.length()
      }
      entry.isDirectory -> walk(entry, tally)
    }
  }

  // Children of a canonical, non-link directory: a child whose canonical path
  // differs from its own is a symlink (API 24 has no lstat in java.io).
  private inline fun forEachEntry(dir: File, action: (File) -> Unit) {
    dir.list()?.forEach { name ->
      val entry = File(dir, name)
      if (!isSymlink(entry)) action(entry)
    }
  }

  private fun isSymlink(entry: File): Boolean = entry.canonicalPath != entry.path
}
