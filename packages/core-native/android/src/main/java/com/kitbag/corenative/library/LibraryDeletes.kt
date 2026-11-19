package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

object LibraryDeletes {
  fun file(folder: DataFolder, relativePath: String) =
    delete(folder, relativePath, { LibraryPaths.resolve(it, relativePath) }, ::deleteFile)

  fun songFolder(folder: DataFolder, folderName: String) =
    deleteFolder(folder, LibraryPaths.SONGS_DIR_NAME, folderName, LibraryPaths::songFolder)

  fun stemFolder(folder: DataFolder, folderName: String) =
    deleteFolder(folder, LibraryPaths.STEMS_DIR_NAME, folderName, LibraryPaths::stemFolder)

  private fun deleteFolder(folder: DataFolder, parent: String, name: String, resolve: (File, String) -> File) =
    delete(folder, "$parent/$name", { resolve(it, name) }, ::deleteRecursively)

  private fun delete(folder: DataFolder, relativePath: String, target: (File) -> File, remove: (File) -> Unit) =
    folder.importing {
      remove(target(folder.root()))
      for (away in folder.awayUnder(relativePath)) {
        away.mountedRoot?.let { remove(target(it)) }
        folder.forgetAway(away.volumeUuid, away.paths)
      }
    }

  private fun deleteFile(file: File) {
    if (file.isDirectory) throw IOException("$file is a directory")
    if (file.exists() && !file.delete()) throw IOException("Could not delete $file")
  }

  private fun deleteRecursively(dir: File) {
    if (dir.exists() && !dir.deleteRecursively()) throw IOException("Could not delete $dir")
  }
}
