package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

object SongAnalyzer {
  class Output(val result: NativeSongAnalysis, val waveform: File?)

  // The core writes the sidecar straight to its final name, so it runs in a
  // staging dir and replaces the previous waveform only once analysis succeeds.
  fun analyze(song: File, waveformDir: File, staging: File): Output {
    staging.deleteRecursively()
    if (!staging.mkdirs() || (!waveformDir.isDirectory && !waveformDir.mkdirs())) {
      throw IOException("Could not prepare the waveform directory")
    }
    try {
      val result = nativeAnalyzeSong(song.path, staging.path)
      val staged = File(nativeWaveformPath(staging.path, song.path))
      val waveform = File(nativeWaveformPath(waveformDir.path, song.path))
      if (staged.isFile) {
        if (!staged.renameTo(waveform)) throw IOException("Could not move the waveform into place")
      } else {
        waveform.delete()
      }
      return Output(result, waveform.takeIf { it.isFile })
    } finally {
      staging.deleteRecursively()
    }
  }

  private external fun nativeAnalyzeSong(path: String, waveformDir: String): NativeSongAnalysis

  private external fun nativeWaveformPath(waveformDir: String, songPath: String): String

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
