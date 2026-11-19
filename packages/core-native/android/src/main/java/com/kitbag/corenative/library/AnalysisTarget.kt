package com.kitbag.corenative.library

import java.io.File

sealed interface AnalysisTarget {
  data class Ready(val relativePath: String) : AnalysisTarget

  object Refused : AnalysisTarget

  object Deferred : AnalysisTarget

  companion object {
    // Deferred, not failed: the song is analysed once its card is back.
    fun of(root: () -> File, relativePath: String, waveformRelativeDir: String): AnalysisTarget =
      try {
        val base = root()
        LibraryPaths.requireInsideLibrary(base, waveformRelativeDir, allowBase = true)
        Ready(LibraryPaths.relativize(base, LibraryPaths.resolve(base, relativePath)))
      } catch (e: IllegalArgumentException) {
        Refused
      } catch (e: DataFolderUnavailableException) {
        Deferred
      }
  }
}
