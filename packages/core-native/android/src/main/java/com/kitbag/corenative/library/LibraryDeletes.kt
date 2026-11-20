package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

class LibraryDeletes(
  private val dataFolder: DataFolder,
  private val leftovers: AwayManifest,
  private val onAwayChanged: () -> Unit,
  private val warn: (message: String, cause: Exception) -> Unit,
) {
  fun file(relativePath: String) = delete({ LibraryPaths.resolve(it, relativePath) }, Removal.FILE)

  fun songFolder(folderName: String) = delete({ LibraryPaths.songFolder(it, folderName) }, Removal.TREE)

  fun stemFolder(folderName: String) = delete({ LibraryPaths.stemFolder(it, folderName) }, Removal.TREE)

  private fun delete(target: (File) -> File, removal: Removal) =
    dataFolder.importing {
      val root = dataFolder.root()
      val inDataFolder = target(root)
      val away = dataFolder.awayUnder(LibraryPaths.relativize(root, inDataFolder), removal.folderMatch)
      removal.removeOrThrow(inDataFolder)
      try {
        for (entry in away) {
          dataFolder.forgetAway(entry.volumeUuid, entry.paths)
          val removedFromCard = entry.mountedRoot?.let { removeFromCard(removal, target(it)) } ?: false
          if (!removedFromCard) park(entry)
        }
      } finally {
        if (away.isNotEmpty()) onAwayChanged()
      }
    }

  private fun removeFromCard(removal: Removal, onCard: File): Boolean =
    try {
      removal.removeOrThrow(onCard)
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

  private enum class Removal(val folderMatch: Boolean, val removeOrThrow: (File) -> Unit) {
    FILE(folderMatch = false, ::deleteFileOrThrow),
    TREE(folderMatch = true, ::deleteTreeOrThrow),
  }
}

private fun deleteFileOrThrow(file: File) {
  if (file.isDirectory) throw IOException("$file is a directory")
  if (file.exists() && !file.delete()) throw IOException("Could not delete $file")
}

private fun deleteTreeOrThrow(dir: File) {
  if (dir.exists() && !dir.deleteRecursively()) throw IOException("Could not delete $dir")
}
