package com.kitbag.corenative.stemdeck.qr

import com.google.zxing.BarcodeFormat
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QrFrameDecoderTest {
  private val decoder = QrFrameDecoder()

  private class Frame(val luma: ByteArray, val width: Int, val height: Int, val rowStride: Int)

  private fun code(): BitMatrix = QRCodeWriter().encode(ADDRESS, BarcodeFormat.QR_CODE, CODE_PX, CODE_PX)

  private fun frame(
    code: BitMatrix = code(),
    width: Int = FRAME_PX,
    height: Int = FRAME_PX,
    rowStride: Int = width,
    left: Int = (width - code.width) / 2,
    top: Int = (height - code.height) / 2,
    dark: Int = BLACK,
    light: Int = WHITE,
  ): Frame {
    val luma = ByteArray(rowStride * height) { PADDING.toByte() }
    for (y in 0 until height) {
      for (x in 0 until width) {
        val cx = x - left
        val cy = y - top
        val inCode = cx in 0 until code.width && cy in 0 until code.height
        luma[y * rowStride + x] = (if (inCode && code[cx, cy]) dark else light).toByte()
      }
    }
    return Frame(luma, width, height, rowStride)
  }

  private fun read(frame: Frame) = decoder.decode(frame.luma, frame.width, frame.height, frame.rowStride)

  private fun rotated(code: BitMatrix): BitMatrix {
    val turned = BitMatrix(code.height, code.width)
    for (y in 0 until code.height) for (x in 0 until code.width) if (code[x, y]) turned.set(code.height - 1 - y, x)
    return turned
  }

  @Test fun readsATightFrame() = assertEquals(ADDRESS, read(frame()))

  @Test fun readsRowsPaddedPastTheWidth() = assertEquals(ADDRESS, read(frame(rowStride = FRAME_PX + ROW_PADDING)))

  @Test fun readsACodeAwayFromTheCentre() = assertEquals(ADDRESS, read(frame(width = WIDE_PX, left = 0, top = 0)))

  @Test fun readsACodeTurnedAQuarter() = assertEquals(ADDRESS, read(frame(code = rotated(code()))))

  @Test fun readsLightOnDark() = assertEquals(ADDRESS, read(frame(dark = WHITE, light = BLACK)))

  @Test fun readsLowContrast() = assertEquals(ADDRESS, read(frame(dark = DIM_DARK, light = DIM_LIGHT)))

  @Test fun returnsNullWithNoCode() = assertNull(read(Frame(ByteArray(FRAME_PX * FRAME_PX) { WHITE.toByte() }, FRAME_PX, FRAME_PX, FRAME_PX)))

  private companion object {
    const val ADDRESS = "https://192.168.1.50:8443"
    const val CODE_PX = 200
    const val FRAME_PX = 320
    const val WIDE_PX = 480
    const val ROW_PADDING = 64
    const val BLACK = 0
    const val WHITE = 255
    const val DIM_DARK = 100
    const val DIM_LIGHT = 140
    const val PADDING = 0x55
  }
}
