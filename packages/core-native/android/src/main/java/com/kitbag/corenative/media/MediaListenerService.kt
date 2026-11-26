package com.kitbag.corenative.media

import android.service.notification.NotificationListenerService
import android.util.Log

class MediaListenerService : NotificationListenerService() {
  override fun onListenerConnected() {
    super.onListenerConnected()
    Log.i(SESSIONS_LOG_TAG, "listener connected")
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    Log.i(SESSIONS_LOG_TAG, "listener disconnected")
  }
}
