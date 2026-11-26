package com.kitbag.corenative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build

internal object CardNotifications {
  const val METRONOME_CHANNEL_ID = "kitbag_metronome_card"
  const val SONG_CHANNEL_ID = "kitbag_songs_card"
  private val RETIRED_CHANNEL_IDS = listOf("kitbag_metronome", "kitbag_songs")

  // Android keeps a channel's importance once created, so raising it takes a new ID.
  fun createChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    RETIRED_CHANNEL_IDS.forEach(manager::deleteNotificationChannel)
    manager.createNotificationChannel(silentChannel(context, METRONOME_CHANNEL_ID, R.string.kitbag_metronome_channel))
    manager.createNotificationChannel(silentChannel(context, SONG_CHANNEL_ID, R.string.kitbag_songs_channel))
  }

  fun launchIntent(context: Context): PendingIntent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }

  private fun silentChannel(context: Context, id: String, name: Int): NotificationChannel =
    NotificationChannel(id, context.getString(name), NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
}
