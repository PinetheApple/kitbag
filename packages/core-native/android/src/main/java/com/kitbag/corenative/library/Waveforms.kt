package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

object Waveforms {
  fun place(
    folder: DataFolder,
    waveformRelativeDir: String,
    staged: File,
    supersede: (relativePath: String) -> Unit,
    warn: (message: String, cause: Exception) -> Unit,
    rename: (File, File) -> Boolean = File::renameTo,
  ): String? =
    folder.importing {
      val root = folder.root()
      val dir = LibraryPaths.resolve(root, waveformRelativeDir, allowBase = true)
      if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not prepare the waveform directory")
      val waveform = File(dir, staged.name)
      if (!staged.isFile) {
        waveform.delete()
        return@importing null
      }
      DurableFiles.move(staged, waveform, rename)
      val relativePath = LibraryPaths.relativize(root, waveform)
      try {
        supersede(relativePath)
      } catch (e: IOException) {
        warn("Could not retire the card copy of $relativePath; the next card return supersedes it", e)
      }
      relativePath.takeIf { waveform.isFile }
    }
}
