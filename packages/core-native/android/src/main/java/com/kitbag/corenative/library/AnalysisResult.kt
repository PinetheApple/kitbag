package com.kitbag.corenative.library

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException

class AnalysisResult(
  val relativePath: String,
  val ok: Boolean,
  val error: String,
  val bpm: Float,
  val beats: FloatArray,
  val downbeats: IntArray,
  val waveformRelativePath: String,
  val durationSec: Double,
) {
  fun writeTo(out: DataOutputStream) {
    out.writeInt(FORMAT_VERSION)
    out.writeUTF(relativePath)
    out.writeBoolean(ok)
    out.writeUTF(error)
    out.writeFloat(bpm)
    out.writeInt(beats.size)
    beats.forEach(out::writeFloat)
    out.writeInt(downbeats.size)
    downbeats.forEach(out::writeInt)
    out.writeUTF(waveformRelativePath)
    out.writeDouble(durationSec)
  }

  companion object {
    private const val FORMAT_VERSION = 2

    // Pending results survive an app update.
    private const val FORMAT_VERSION_NO_DURATION = 1
    const val UNKNOWN_DURATION_SEC = 0.0

    fun failed(relativePath: String, error: String) =
      AnalysisResult(relativePath, false, error, 0f, FloatArray(0), IntArray(0), "", UNKNOWN_DURATION_SEC)

    fun readFrom(input: DataInputStream): AnalysisResult {
      val version = input.readInt()
      if (version != FORMAT_VERSION && version != FORMAT_VERSION_NO_DURATION) {
        throw IOException("Unknown analysis result format $version")
      }
      val relativePath = input.readUTF()
      val ok = input.readBoolean()
      val error = input.readUTF()
      val bpm = input.readFloat()
      val beats = FloatArray(checkedCount(input.readInt())) { input.readFloat() }
      val downbeats = IntArray(checkedCount(input.readInt())) { input.readInt() }
      val waveformRelativePath = input.readUTF()
      val durationSec = if (version == FORMAT_VERSION) input.readDouble() else UNKNOWN_DURATION_SEC
      return AnalysisResult(relativePath, ok, error, bpm, beats, downbeats, waveformRelativePath, durationSec)
    }

    private fun checkedCount(count: Int): Int {
      if (count < 0) throw IOException("Corrupt analysis result")
      return count
    }
  }
}
