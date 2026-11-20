package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

object SongAnalyzer {
  class Output(val result: NativeSongAnalysis, val waveformRelativePath: String?)

  // The core writes the sidecar straight to its final name, so it runs in a
  // staging dir and replaces the previous waveform only once analysis succeeds.
  fun analyze(song: File, staging: File, place: (staged: File) -> String?): Output {
    staging.deleteRecursively()
    if (!staging.mkdirs()) throw IOException("Could not prepare the analysis staging directory")
    try {
      val result = nativeAnalyzeSong(song.path, staging.path)
      return Output(result, place(File(nativeWaveformPath(staging.path, song.path))))
    } finally {
      staging.deleteRecursively()
    }
  }

  private external fun nativeAnalyzeSong(path: String, waveformDir: String): NativeSongAnalysis

  fun waveformPath(waveformDir: File, song: File): String = nativeWaveformPath(waveformDir.path, song.path)

  private external fun nativeWaveformPath(waveformDir: String, songPath: String): String

  fun isWaveformSidecar(path: String): Boolean = nativeIsWaveformSidecar(path)

  private external fun nativeIsWaveformSidecar(path: String): Boolean

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
