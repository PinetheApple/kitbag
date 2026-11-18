package com.kitbag.corenative.stemdeck.qr

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap

object QrScan {
  const val EXTRA_TEXT = "com.kitbag.corenative.stemdeck.qr.TEXT"
  const val EXTRA_TYPE_ADDRESS = "com.kitbag.corenative.stemdeck.qr.TYPE_ADDRESS"
  const val READ = "read"
  const val TYPE_ADDRESS = "typeAddress"

  val CONSTANTS: Map<String, Any> = mapOf("scanRead" to READ, "scanTypeAddress" to TYPE_ADDRESS)
}

class QrScanLauncher(private val context: ReactApplicationContext) : ActivityEventListener {
  private var pending: Promise? = null

  fun scan(look: ReadableMap, promise: Promise) {
    val activity = context.currentActivity
    val extras = Arguments.toBundle(look)
    if (activity == null || extras == null) {
      promise.reject(E_NO_ACTIVITY, "No foreground activity to scan from")
      return
    }
    synchronized(this) {
      if (pending != null) {
        promise.reject(E_IN_PROGRESS, "A scan is already open")
        return
      }
      pending = promise
    }
    val intent = Intent(activity, QrScanActivity::class.java).putExtras(extras)
    activity.runOnUiThread {
      try {
        activity.startActivityForResult(intent, REQUEST_SCAN)
      } catch (e: ActivityNotFoundException) {
        take()?.reject(E_NO_ACTIVITY, "The scanner is missing from this build", e)
      }
    }
  }

  // A torn-down module never hears the result, so the waiting scan ends as cancelled.
  fun cancel() {
    take()?.resolve(null)
  }

  @Synchronized
  private fun take(): Promise? = pending.also { pending = null }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_SCAN) return
    take()?.resolve(result(resultCode, data))
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun result(resultCode: Int, data: Intent?): WritableMap? {
    if (resultCode != Activity.RESULT_OK || data == null) return null
    val text = data.getStringExtra(QrScan.EXTRA_TEXT)
    val outcome = when {
      text != null -> QrScan.READ
      data.getBooleanExtra(QrScan.EXTRA_TYPE_ADDRESS, false) -> QrScan.TYPE_ADDRESS
      else -> return null
    }
    return Arguments.createMap().apply {
      putString("outcome", outcome)
      putString("text", text)
    }
  }

  private companion object {
    const val REQUEST_SCAN = 0x4b45
    const val E_NO_ACTIVITY = "E_NO_ACTIVITY"
    const val E_IN_PROGRESS = "E_SCAN_IN_PROGRESS"
  }
}
