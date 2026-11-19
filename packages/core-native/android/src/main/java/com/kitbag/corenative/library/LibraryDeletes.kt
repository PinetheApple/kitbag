package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

class LibraryDeletes(
  private val folder: DataFolder,
  private val leftovers: AwayManifest,
  private val warn: (message: String, cause: Exception) -> Unit,
) {
  fun file(relativePath: String) =
    delete({ LibraryPaths.resolve(it, relativePath) }, folderMatch = false, ::deleteFile)

  fun songFolder(folderName: String) =
    delete({ LibraryPaths.songFolder(it, folderName) }, folderMatch = true, ::deleteRecursively)

  fun stemFolder(folderName: String) =
    delete({ LibraryPaths.stemFolder(it, folderName) }, folderMatch = true, ::deleteRecursively)

  private fun delete(target: (File) -> File, folderMatch: Boolean, remove: (File) -> Unit) =
    folder.importing {
      val root = folder.root()
      val inDataFolder = target(root)
      val away = folder.awayUnder(LibraryPaths.relativize(root, inDataFolder), folderMatch)
      remove(inDataFolder)
      for (entry in away) {
        folder.forgetAway(entry.volumeUuid, entry.paths)
        val removedFromCard = entry.mountedRoot?.let { removeFromCard(remove, target(it)) } ?: false
        if (!removedFromCard) park(entry)
      }
    }

  private fun removeFromCard(remove: (File) -> Unit, onCard: File): Boolean =
    try {
      remove(onCard)
      true
    } catch (e: IOException) {
      warn("Could not delete $onCard; left for the next clean-up", e)
      false
    }

  private fun park(entry: AwayFiles) {
    try {
      leftovers.record(entry.volumeUuid, entry.paths)
    } catch (e: IOException) {
      warn("Could not list the deleted files on ${entry.volumeUuid} for clean-up", e)
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
