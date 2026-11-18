package com.kitbag.corenative.stemdeck.qr

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.util.TypedValue
import android.view.View
import kotlin.math.roundToInt

@SuppressLint("ViewConstructor")
class ViewfinderView(context: Context, private val look: ScanLook) : View(context) {
  private val density = resources.displayMetrics.density
  private val scrim = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = look.scrimColor
    alpha = (look.scrimOpacity * OPAQUE).roundToInt()
  }
  private val corner = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = look.cornerColor
    style = Paint.Style.STROKE
    strokeWidth = look.strokeDp * density
  }
  private val promptPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    color = look.promptInk
    textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, look.promptSp, resources.displayMetrics)
  }
  private val shade = Path()
  private val corners = Path()

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val frame = look.frameDp * density
    val box = RectF((width - frame) / 2, (height - frame) / 2, (width + frame) / 2, (height + frame) / 2)
    val radius = look.cornerRadiusDp * density
    shade.reset()
    shade.fillType = Path.FillType.EVEN_ODD
    shade.addRect(0f, 0f, width.toFloat(), height.toFloat(), Path.Direction.CW)
    shade.addRoundRect(box, radius, radius, Path.Direction.CW)
    canvas.drawPath(shade, scrim)
    drawCorners(canvas, box, radius)
    drawPrompt(canvas, box)
  }

  // The stroke is centred on its path, so the path runs half a stroke inside the box.
  private fun drawCorners(canvas: Canvas, box: RectF, radius: Float) {
    val half = corner.strokeWidth / 2
    val inner = RectF(box.left + half, box.top + half, box.right - half, box.bottom - half)
    val arm = look.cornerDp * density - half
    val arc = radius - half
    corners.reset()
    corners.moveTo(inner.left, inner.top + arm)
    corners.arcTo(RectF(inner.left, inner.top, inner.left + 2 * arc, inner.top + 2 * arc), HALF_TURN, QUARTER_TURN)
    corners.lineTo(inner.left + arm, inner.top)
    corners.moveTo(inner.right - arm, inner.top)
    corners.arcTo(RectF(inner.right - 2 * arc, inner.top, inner.right, inner.top + 2 * arc), -QUARTER_TURN, QUARTER_TURN)
    corners.lineTo(inner.right, inner.top + arm)
    corners.moveTo(inner.right, inner.bottom - arm)
    corners.arcTo(RectF(inner.right - 2 * arc, inner.bottom - 2 * arc, inner.right, inner.bottom), 0f, QUARTER_TURN)
    corners.lineTo(inner.right - arm, inner.bottom)
    corners.moveTo(inner.left + arm, inner.bottom)
    corners.arcTo(RectF(inner.left, inner.bottom - 2 * arc, inner.left + 2 * arc, inner.bottom), QUARTER_TURN, QUARTER_TURN)
    corners.lineTo(inner.left, inner.bottom - arm)
    canvas.drawPath(corners, corner)
  }

  private fun drawPrompt(canvas: Canvas, box: RectF) {
    val inset = look.promptInsetDp * density
    val textWidth = (width - 2 * inset).roundToInt().coerceAtLeast(1)
    val layout = StaticLayout.Builder
      .obtain(look.prompt, 0, look.prompt.length, promptPaint, textWidth)
      .setAlignment(Layout.Alignment.ALIGN_CENTER)
      .build()
    canvas.save()
    canvas.translate(inset, box.bottom + look.promptGapDp * density)
    layout.draw(canvas)
    canvas.restore()
  }

  private companion object {
    const val OPAQUE = 255
    const val HALF_TURN = 180f
    const val QUARTER_TURN = 90f
  }
}
