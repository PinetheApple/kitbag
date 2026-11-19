package com.kitbag.corenative.library

import java.io.File

class MixdownExport(private val cacheDir: File) {
  class Started(val result: Int, val path: String)

  fun start(fileName: String): Started? {
    val name = ExportFiles.exportName(fileName) ?: return null
    if (!nativeRunning()) ExportFiles.clear(cacheDir)
    val file = File(ExportFiles.dir(cacheDir).apply { mkdirs() }, name)
    return Started(nativeStart(file.path), file.path)
  }

  fun cancel() = nativeCancel()

  private external fun nativeStart(path: String): Int

  private external fun nativeCancel()

  private external fun nativeRunning(): Boolean
}
