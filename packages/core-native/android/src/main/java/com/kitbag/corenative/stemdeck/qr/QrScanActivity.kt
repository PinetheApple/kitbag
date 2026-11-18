package com.kitbag.corenative.stemdeck.qr

import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.kitbag.corenative.R
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

class QrScanActivity : ComponentActivity() {
  private val decoder = QrFrameDecoder()
  private val analysis: ExecutorService = Executors.newSingleThreadExecutor()
  private val done = AtomicBoolean(false)
  private var luma = ByteArray(0)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val extras = intent.extras
    if (extras == null) {
      finishWith(RESULT_CANCELED, null)
      return
    }
    val look = ScanLook(extras)
    val preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
    setContentView(layout(look, preview))
    startCamera(preview)
  }

  override fun onDestroy() {
    analysis.shutdown()
    super.onDestroy()
  }

  private fun dp(value: Float) = (value * resources.displayMetrics.density).roundToInt()

  private fun layout(look: ScanLook, preview: PreviewView): View {
    val bar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      minimumHeight = dp(look.barHeightDp)
      setBackgroundColor(look.barColor)
      addView(backButton(look), LinearLayout.LayoutParams(dp(look.touchTargetDp), dp(look.touchTargetDp)))
      addView(
        TextView(context).apply {
          text = look.title
          setTextColor(look.barInk)
          setTextSize(TypedValue.COMPLEX_UNIT_SP, look.titleSp)
          maxLines = 1
        },
      )
    }
    val typeAddress = TextView(this).apply {
      text = look.typeAddress
      gravity = Gravity.CENTER
      minHeight = dp(look.touchTargetDp)
      setTextColor(look.actionInk)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, look.actionSp)
      setBackgroundColor(look.barColor)
      isClickable = true
      isFocusable = true
      setOnClickListener { finishWith(RESULT_OK, Intent().putExtra(QrScan.EXTRA_TYPE_ADDRESS, true)) }
    }
    val root = FrameLayout(this).apply {
      addView(preview, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
      addView(ViewfinderView(context, look), FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
      addView(bar, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.TOP))
      addView(typeAddress, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
    }
    ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      bar.setPadding(bars.left, bars.top, bars.right, 0)
      typeAddress.setPadding(bars.left, 0, bars.right, bars.bottom)
      insets
    }
    return root
  }

  private fun backButton(look: ScanLook) =
    ImageButton(this).apply {
      setImageResource(R.drawable.kitbag_back)
      imageTintList = ColorStateList.valueOf(look.barInk)
      background = null
      contentDescription = look.backLabel
      setOnClickListener { finishWith(RESULT_CANCELED, null) }
    }

  private fun startCamera(previewView: PreviewView) {
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener({
      try {
        val provider = future.get()
        val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
        val frames = ImageAnalysis.Builder()
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .build()
          .also { it.setAnalyzer(analysis, ::analyze) }
        provider.unbindAll()
        provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, frames)
      } catch (e: Exception) {
        Log.w(LOG_TAG, "Camera did not open", e)
        finishWith(RESULT_CANCELED, null)
      }
    }, ContextCompat.getMainExecutor(this))
  }

  // The Y plane of YUV_420_888 always has a pixel stride of 1; its rows may be padded.
  private fun analyze(image: ImageProxy) {
    image.use {
      if (done.get()) return
      val plane = it.planes[0]
      val buffer = plane.buffer.apply { rewind() }
      val needed = plane.rowStride * it.height
      if (luma.size != needed) luma = ByteArray(needed)
      buffer.get(luma, 0, minOf(buffer.remaining(), needed))
      val text = decoder.decode(luma, it.width, it.height, plane.rowStride) ?: return
      runOnUiThread { finishWith(RESULT_OK, Intent().putExtra(QrScan.EXTRA_TEXT, text)) }
    }
  }

  private fun finishWith(result: Int, data: Intent?) {
    if (!done.compareAndSet(false, true)) return
    setResult(result, data)
    finish()
  }

  private companion object {
    const val LOG_TAG = "KitbagQrScan"
  }
}
