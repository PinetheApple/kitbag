package com.kitbag.corenative.library

import java.io.File

data class LibraryAudioUsage(val songs: Int, val bytes: Long)

data class StemSetUsage(val count: Int, val bytes: Long)

data class StorageUsage(
  val libraryAudio: LibraryAudioUsage,
  val stemSets: StemSetUsage,
  val databaseBytes: Long,
)

object LibraryUsage {
  private val SQLITE_SIDE_SUFFIXES = listOf("-wal", "-shm", "-journal")

  fun measure(base: File, database: File): StorageUsage {
    var songs = 0
    var songBytes = 0L
    var stemSets = 0
    var stemBytes = 0L
    for (entry in entries(base.canonicalFile)) {
      when (entry.name) {
        LibraryPaths.SONGS_DIR_NAME -> for (child in entries(entry)) {
          if (isVisibleFolder(child) && hasFinishedAudio(child)) songs++
          songBytes += bytesOf(child)
        }
        LibraryPaths.STEMS_DIR_NAME -> for (child in entries(entry)) {
          if (isVisibleFolder(child)) stemSets++
          stemBytes += bytesOf(child)
        }
        else -> songBytes += bytesOf(entry)
      }
    }
    return StorageUsage(
      LibraryAudioUsage(songs, songBytes),
      StemSetUsage(stemSets, stemBytes),
      databaseBytes(database),
    )
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
      .filter { !isSymlinkInCanonicalDir(it) && it.isFile }
      .sumOf { it.length() }
  }

  private fun isVisibleFolder(entry: File): Boolean = entry.isDirectory && !LibraryPaths.isHiddenName(entry.name)

  // An import reserves an empty visible file and copies into a hidden ".part"
  // sibling, so a song folder is finished once a visible file has content.
  private fun hasFinishedAudio(folder: File): Boolean =
    entries(folder).any { it.isFile && !LibraryPaths.isHiddenName(it.name) && it.length() > 0 }

  private fun bytesOf(entry: File): Long =
    when {
      entry.isFile -> entry.length()
      entry.isDirectory -> entries(entry).sumOf(::bytesOf)
      else -> 0
    }

  private fun entries(dir: File): Sequence<File> =
    dir.list().orEmpty().asSequence().map { File(dir, it) }.filterNot(::isSymlinkInCanonicalDir)

  // API 24 has no lstat in java.io; only valid when the parent path is canonical.
  private fun isSymlinkInCanonicalDir(entry: File): Boolean = entry.canonicalPath != entry.path
}
