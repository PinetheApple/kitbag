package com.kitbag.corenative.library

import java.io.File

class MixdownExport(private val cacheDir: File) {
  class Started(val result: Int, val path: String)

  // Null for a file name that would not be safe as a path.
  fun start(fileName: String): Started? {
    if (!ExportFiles.isSafeFileName(fileName)) return null
    if (!nativeRunning()) ExportFiles.clear(cacheDir)
    val file = File(ExportFiles.dir(cacheDir).apply { mkdirs() }, fileName)
    return Started(nativeStart(file.path), file.path)
  }

  fun cancel() = nativeCancel()

  private external fun nativeStart(path: String): Int

  private external fun nativeCancel()

  private external fun nativeRunning(): Boolean
}
