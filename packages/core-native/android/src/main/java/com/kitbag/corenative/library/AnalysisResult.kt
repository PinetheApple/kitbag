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
  val analysisVersion: Int?,
  val tempo: AnalysedTempo?,
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
    out.writeBoolean(analysisVersion != null)
    analysisVersion?.let(out::writeInt)
    out.writeBoolean(tempo != null)
    tempo?.let { writeTempo(out, it) }
  }

  private fun writeTempo(out: DataOutputStream, tempo: AnalysedTempo) {
    out.writeBoolean(tempo is AnalysedTempo.Steady)
    if (tempo !is AnalysedTempo.Steady) return
    out.writeDouble(tempo.bpm)
    out.writeDouble(tempo.anchorSec)
    out.writeInt(tempo.beatsPerBar)
  }

  companion object {
    private const val FORMAT_VERSION = 4

    // Pending results survive an app update.
    private const val FORMAT_VERSION_NO_DURATION = 1
    private const val FORMAT_VERSION_NO_ANALYSIS_VERSION = 2
    private const val FORMAT_VERSION_NO_TEMPO = 3
    private val KNOWN_FORMATS =
      setOf(FORMAT_VERSION, FORMAT_VERSION_NO_DURATION, FORMAT_VERSION_NO_ANALYSIS_VERSION, FORMAT_VERSION_NO_TEMPO)
    const val UNKNOWN_DURATION_SEC = 0.0

    fun failed(relativePath: String, error: String) =
      AnalysisResult(relativePath, false, error, 0f, FloatArray(0), IntArray(0), "", UNKNOWN_DURATION_SEC, null, null)

    fun readFrom(input: DataInputStream): AnalysisResult {
      val format = input.readInt()
      if (format !in KNOWN_FORMATS) {
        throw IOException("Unknown analysis result format $format")
      }
      val relativePath = input.readUTF()
      val ok = input.readBoolean()
      val error = input.readUTF()
      val bpm = input.readFloat()
      val beats = FloatArray(checkedCount(input.readInt())) { input.readFloat() }
      val downbeats = IntArray(checkedCount(input.readInt())) { input.readInt() }
      val waveformRelativePath = input.readUTF()
      val durationSec = if (format == FORMAT_VERSION_NO_DURATION) UNKNOWN_DURATION_SEC else input.readDouble()
      val analysisVersion = if (format <= FORMAT_VERSION_NO_ANALYSIS_VERSION) null else readOptionalInt(input)
      val tempo = if (format <= FORMAT_VERSION_NO_TEMPO) null else readOptionalTempo(input)
      return AnalysisResult(
        relativePath, ok, error, bpm, beats, downbeats, waveformRelativePath, durationSec, analysisVersion, tempo,
      )
    }

    private fun readOptionalTempo(input: DataInputStream): AnalysedTempo? {
      if (!input.readBoolean()) return null
      if (!input.readBoolean()) return AnalysedTempo.Unsteady
      return AnalysedTempo.Steady(input.readDouble(), input.readDouble(), input.readInt())
    }

    private fun readOptionalInt(input: DataInputStream): Int? = if (input.readBoolean()) input.readInt() else null

    private fun checkedCount(count: Int): Int {
      if (count < 0) throw IOException("Corrupt analysis result")
      return count
    }
  }
}
