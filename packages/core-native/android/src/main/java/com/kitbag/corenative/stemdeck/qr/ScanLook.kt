package com.kitbag.corenative.stemdeck.qr

import android.graphics.Color
import android.os.Bundle

class ScanLook(bundle: Bundle) {
  val title: String = bundle.getString("title").orEmpty()
  val prompt: String = bundle.getString("prompt").orEmpty()
  val typeAddress: String = bundle.getString("typeAddress").orEmpty()
  val backLabel: String = bundle.getString("backLabel").orEmpty()
  val barColor: Int = color(bundle, "barColor")
  val barInk: Int = color(bundle, "barInk")
  val actionInk: Int = color(bundle, "actionInk")
  val scrimColor: Int = color(bundle, "scrimColor")
  val scrimOpacity: Float = bundle.getDouble("scrimOpacity").toFloat()
  val promptInk: Int = color(bundle, "promptInk")
  val cornerColor: Int = color(bundle, "cornerColor")
  val frameDp: Float = number(bundle, "frameDp")
  val cornerDp: Float = number(bundle, "cornerDp")
  val strokeDp: Float = number(bundle, "strokeDp")
  val cornerRadiusDp: Float = number(bundle, "cornerRadiusDp")
  val promptGapDp: Float = number(bundle, "promptGapDp")
  val promptInsetDp: Float = number(bundle, "promptInsetDp")
  val barHeightDp: Float = number(bundle, "barHeightDp")
  val touchTargetDp: Float = number(bundle, "touchTargetDp")
  val titleSp: Float = number(bundle, "titleSp")
  val actionSp: Float = number(bundle, "actionSp")
  val promptSp: Float = number(bundle, "promptSp")

  private fun color(bundle: Bundle, key: String): Int = Color.parseColor(bundle.getString(key))

  private fun number(bundle: Bundle, key: String): Float = bundle.getDouble(key).toFloat()
}
