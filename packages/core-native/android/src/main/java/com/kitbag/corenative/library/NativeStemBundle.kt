package com.kitbag.corenative.library

import java.io.File

object NativeStemBundle : WaveformSidecarWriter {
  private const val MONO = 1

  val maxStems: Int by lazy { nativeMaxTracks() }

  override fun write(stem: File, totalFrames: Long, peaks: FloatArray): File? {
    val target = File(SongAnalyzer.waveformPath(stem.parentFile ?: return null, stem))
    return target.takeIf { nativeWritePeaks(it.path, MONO, totalFrames, peaks, peaks.size / StemBundleMembers.PEAK_VALUES_PER_CHUNK) }
  }

  private external fun nativeWritePeaks(path: String, channels: Int, totalFrames: Long, peaks: FloatArray, chunkCount: Int): Boolean

  private external fun nativeMaxTracks(): Int

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
