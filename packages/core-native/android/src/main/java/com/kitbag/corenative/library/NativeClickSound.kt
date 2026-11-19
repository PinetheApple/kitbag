package com.kitbag.corenative.library

import java.io.File

object NativeClickSound {
  fun prepare(source: File, target: File): Int = nativePrepare(source.path, target.path)

  fun noSpace(): Int = nativeNoSpace()

  private external fun nativePrepare(inPath: String, outPath: String): Int

  private external fun nativeNoSpace(): Int

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
