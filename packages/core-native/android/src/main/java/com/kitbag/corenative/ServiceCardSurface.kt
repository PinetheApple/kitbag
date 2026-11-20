package com.kitbag.corenative

import android.app.ForegroundServiceStartNotAllowedException
import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.ServiceCompat
import com.kitbag.corenative.transport.CardSurface

internal class ServiceCardSurface(private val service: Service, private val notificationId: Int) :
  CardSurface<Notification> {
  private val manager: NotificationManager
    get() = service.getSystemService(NotificationManager::class.java)

  override fun promote(notification: Notification): Throwable? =
    try {
      ServiceCompat.startForeground(
        service,
        notificationId,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
      )
      null
    } catch (e: IllegalStateException) {
      if (refusedInBackground(e)) e else throw e
    }

  override fun notify(notification: Notification) = manager.notify(notificationId, notification)

  override fun remove() {
    ServiceCompat.stopForeground(service, ServiceCompat.STOP_FOREGROUND_REMOVE)
    manager.cancel(notificationId)
  }

  private fun refusedInBackground(e: IllegalStateException): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && e is ForegroundServiceStartNotAllowedException
}
