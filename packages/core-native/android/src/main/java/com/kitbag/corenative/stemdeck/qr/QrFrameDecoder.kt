package com.kitbag.corenative.stemdeck.qr

import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.LuminanceSource
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.ReaderException
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader

class QrFrameDecoder {
  private val reader = QRCodeReader()

  fun decode(luma: ByteArray, width: Int, height: Int, rowStride: Int): String? {
    val source = PlanarYUVLuminanceSource(luma, rowStride, height, 0, 0, width, height, false)
    return read(source) ?: read(source.invert())
  }

  private fun read(source: LuminanceSource): String? =
    try {
      reader.decode(BinaryBitmap(HybridBinarizer(source)), HINTS).text
    } catch (e: ReaderException) {
      null
    } finally {
      reader.reset()
    }

  private companion object {
    val HINTS = mapOf(DecodeHintType.TRY_HARDER to true)
  }
}
