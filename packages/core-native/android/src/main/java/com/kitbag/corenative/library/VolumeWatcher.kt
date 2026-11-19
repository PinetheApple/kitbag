package com.kitbag.corenative.library

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean

class VolumeWatcher(private val context: Context, private val onChange: () -> Unit) {
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = onChange()
  }

  private val registered = AtomicBoolean(false)

  fun start() {
    if (registered.compareAndSet(false, true)) {
      ContextCompat.registerReceiver(context, receiver, filter(), ContextCompat.RECEIVER_NOT_EXPORTED)
    }
  }

  fun stop() {
    if (registered.compareAndSet(true, false)) context.unregisterReceiver(receiver)
  }

  private companion object {
    val ACTIONS = listOf(
      Intent.ACTION_MEDIA_MOUNTED,
      Intent.ACTION_MEDIA_UNMOUNTED,
      Intent.ACTION_MEDIA_EJECT,
      Intent.ACTION_MEDIA_REMOVED,
      Intent.ACTION_MEDIA_BAD_REMOVAL,
    )
    const val VOLUME_SCHEME = "file"

    // Media broadcasts carry the volume as a file: URI; a filter without the scheme never matches them.
    fun filter() = IntentFilter().apply {
      ACTIONS.forEach(::addAction)
      addDataScheme(VOLUME_SCHEME)
    }
  }
}
