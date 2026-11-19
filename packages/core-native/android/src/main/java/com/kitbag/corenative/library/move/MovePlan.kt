package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.LibraryPaths
import java.io.File

data class MoveSourceFile(val path: String, val size: Long, val modified: Long)

object MovePlan {
  private val MOVED_DIRS = listOf(LibraryPaths.SONGS_DIR_NAME, LibraryPaths.STEMS_DIR_NAME)

  fun requiredBytes(root: File): Long = scan(root).sumOf { it.size } + MoveRunner.FREE_SPACE_MARGIN_BYTES

  fun scan(root: File): List<MoveSourceFile> {
    val base = root.canonicalFile
    return MOVED_DIRS.flatMap { dirName ->
      File(base, dirName).walkTopDown()
        .onEnter { !LibraryPaths.isHiddenName(it.name) }
        .filter { it.isFile && !LibraryPaths.isHiddenName(it.name) && it.canonicalFile.startsWith(base) }
        .map { MoveSourceFile(LibraryPaths.relativize(base, it), it.length(), it.lastModified()) }
        .toList()
    }.sortedBy { it.path }
  }
}
