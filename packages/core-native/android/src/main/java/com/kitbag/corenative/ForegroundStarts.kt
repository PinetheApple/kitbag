package com.kitbag.corenative

import android.app.ForegroundServiceStartNotAllowedException
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat

internal class ForegroundStarts(private val logTag: String) {
  @Volatile var running = false

  @Volatile private var startRequested = false

  val live: Boolean
    get() = running || startRequested

  fun stopped() {
    running = false
    startRequested = false
  }

  // An update to a live service needs no new foreground start, which Android 12+
  // refuses from the background.
  fun start(context: Context, intent: Intent) {
    if (running) {
      context.startService(intent)
      return
    }
    try {
      ContextCompat.startForegroundService(context, intent)
      startRequested = true
    } catch (e: IllegalStateException) {
      if (!refusedInBackground(e)) throw e
      Log.w(logTag, "Foreground start refused in the background", e)
    }
  }

  private fun refusedInBackground(e: IllegalStateException): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && e is ForegroundServiceStartNotAllowedException
}
