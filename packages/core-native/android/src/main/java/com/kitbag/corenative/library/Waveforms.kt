package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

object Waveforms {
  fun place(
    folder: DataFolder,
    waveformRelativeDir: String,
    staged: File,
    rename: (File, File) -> Boolean = File::renameTo,
  ): String? =
    folder.importing {
      val root = folder.root()
      val dir = LibraryPaths.resolve(root, waveformRelativeDir, allowBase = true)
      if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not prepare the waveform directory")
      val waveform = File(dir, staged.name)
      if (staged.isFile) DurableFiles.move(staged, waveform, rename) else waveform.delete()
      waveform.takeIf { it.isFile }?.let { LibraryPaths.relativize(root, it) }
    }
}
