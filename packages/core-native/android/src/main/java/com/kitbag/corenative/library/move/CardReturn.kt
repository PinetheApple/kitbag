package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.SystemDiskSync
import java.io.File
import java.io.IOException

// Copies wait in a hidden folder on the target: under their own paths they would play before being verified.
internal object CardReturn {
  const val STAGING_DIR_NAME = ".card-return"

  fun plan(cardRoot: File, awayPaths: Set<String>): List<MoveEntry> =
    awayPaths.sorted().mapNotNull { path ->
      LibraryPaths.resolve(cardRoot, path).takeIf { it.isFile }?.let { MoveEntry(path, it.length(), it.lastModified()) }
    }

  fun drop(targetRoot: File, path: String) = MoveFiles.deleteCopy(stagingRoot(targetRoot), path)

  fun stagingRoot(targetRoot: File) = File(targetRoot, STAGING_DIR_NAME)

  fun stagedPath(path: String) = "$STAGING_DIR_NAME/$path"

  // No staged file: placed by an earlier attempt, or placed and since deleted with its song.
  fun place(targetRoot: File, path: String) {
    val staged = LibraryPaths.resolve(stagingRoot(targetRoot), path)
    val placed = LibraryPaths.resolve(targetRoot, path)
    if (!staged.isFile) return
    val dir = placed.parentFile ?: throw IOException("No folder for $path")
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create the folder for $path")
    if (!staged.renameTo(placed)) throw IOException("Could not move $path into place")
    SystemDiskSync.directory(dir)
    MoveFiles.deleteCopy(stagingRoot(targetRoot), path)
  }
}
