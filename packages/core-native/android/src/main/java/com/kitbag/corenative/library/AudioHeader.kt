package com.kitbag.corenative.library

import java.io.InputStream

object AudioHeader {
  private const val FTYP_OFFSET = 4
  private const val OGG_OFFSET = 0
  private val FTYP = "ftyp".toByteArray(Charsets.US_ASCII)
  private val OGG_CAPTURE = "OggS".toByteArray(Charsets.US_ASCII)

  private const val BYTE_MASK = 0xFF
  private const val FRAME_SYNC_BYTE = 0xFF
  private const val ADTS_SYNC_LAYER_MASK = 0xF6
  private const val ADTS_SYNC_LAYER = 0xF0
  private const val ADTS_MIN_BYTES = 2

  val SIZE = maxOf(FTYP_OFFSET + FTYP.size, OGG_OFFSET + OGG_CAPTURE.size, ADTS_MIN_BYTES)

  // Any failure to open or read is left to the copy step, which reports the real error.
  fun sniff(open: () -> InputStream?): String? =
    try {
      open()?.use { unsupportedFormat(read(it)) }
    } catch (e: Exception) {
      null
    }

  fun read(input: InputStream): ByteArray {
    val header = ByteArray(SIZE)
    var filled = 0
    while (filled < SIZE) {
      val got = input.read(header, filled, SIZE - filled)
      if (got < 0) break
      filled += got
    }
    return header.copyOf(filled)
  }

  fun unsupportedFormat(header: ByteArray): String? =
    when {
      header.has(FTYP, FTYP_OFFSET) -> SupportedAudio.M4A
      header.has(OGG_CAPTURE, OGG_OFFSET) -> SupportedAudio.OGG
      isAdts(header) -> SupportedAudio.AAC
      else -> null
    }

  private fun ByteArray.has(signature: ByteArray, offset: Int): Boolean =
    size >= offset + signature.size &&
      signature.indices.all { this[offset + it] == signature[it] }

  // MP3 frames share the 0xFFF sync; only ADTS has the layer bits at 00.
  private fun isAdts(header: ByteArray): Boolean =
    header.size >= ADTS_MIN_BYTES &&
      (header[0].toInt() and BYTE_MASK) == FRAME_SYNC_BYTE &&
      (header[1].toInt() and ADTS_SYNC_LAYER_MASK) == ADTS_SYNC_LAYER
}
