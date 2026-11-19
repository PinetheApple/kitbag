package com.kitbag.corenative.library

import java.io.File

object NativeClickSound {
  fun prepare(source: File, target: File): Int = nativePrepare(source.path, target.path)

  private external fun nativePrepare(inPath: String, outPath: String): Int

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
