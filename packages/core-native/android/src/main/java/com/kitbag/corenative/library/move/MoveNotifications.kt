package com.kitbag.corenative.library.move

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.text.format.Formatter
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.kitbag.corenative.R
import com.kitbag.corenative.library.DataFolderLocation

class MoveNotifications(private val context: Context) {
  private val manager = NotificationManagerCompat.from(context)

  fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.kitbag_data_folder_channel),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  fun starting(): Notification =
    builder()
      .setContentTitle(context.getString(R.string.kitbag_data_folder_starting))
      .setProgress(MoveNotice.PROGRESS_MAX, 0, true)
      .build()

  fun running(status: MoveStatus, targetName: String): Notification {
    val notice = MoveNotice.of(status)
    val builder = builder()
      .setContentTitle(context.getString(R.string.kitbag_data_folder_moving, targetName))
      .setContentText(text(notice))
      .setProgress(MoveNotice.PROGRESS_MAX, notice.percent, notice.stage == MoveNotice.Stage.CLEANING)
    if (notice.cancellable) {
      builder.addAction(0, context.getString(R.string.kitbag_data_folder_cancel), cancelIntent())
    }
    return builder.build()
  }

  fun targetName(target: DataFolderLocation, cardDescription: (String) -> String?): String =
    when (target) {
      DataFolderLocation.Internal -> context.getString(R.string.kitbag_data_folder_internal)
      is DataFolderLocation.Card ->
        cardDescription(target.volumeUuid) ?: context.getString(R.string.kitbag_data_folder_card)
    }

  // Without the permission Android 13+ drops the post; the move itself does not depend on it.
  fun update(notification: Notification) {
    try {
      if (manager.areNotificationsEnabled()) manager.notify(NOTIFICATION_ID, notification)
    } catch (e: SecurityException) {
      Log.w(MOVE_LOG_TAG, "Move notification not posted", e)
    }
  }

  private fun text(notice: MoveNotice): String {
    val done = Formatter.formatShortFileSize(context, notice.doneBytes)
    val total = Formatter.formatShortFileSize(context, notice.totalBytes)
    return when (notice.stage) {
      MoveNotice.Stage.COPYING -> context.getString(R.string.kitbag_data_folder_copying, done, total)
      MoveNotice.Stage.CHECKING -> context.getString(R.string.kitbag_data_folder_checking, done, total)
      MoveNotice.Stage.CLEANING -> context.getString(R.string.kitbag_data_folder_cleaning)
    }
  }

  private fun builder(): NotificationCompat.Builder =
    NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.kitbag_notification)
      .setSilent(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openSongs())

  private fun openSongs(): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(SONGS_LINK)).setPackage(context.packageName)
    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    return PendingIntent.getActivity(context, SONGS_LINK.hashCode(), intent, flags)
  }

  private fun cancelIntent(): PendingIntent {
    val intent = Intent(context, DataFolderMoveService::class.java).setAction(DataFolderMoveService.ACTION_CANCEL)
    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    return PendingIntent.getService(context, DataFolderMoveService.ACTION_CANCEL.hashCode(), intent, flags)
  }

  companion object {
    const val CHANNEL_ID = "kitbag_data_folder"
    const val NOTIFICATION_ID = 3
    const val SONGS_LINK = "kitbag://songs"
  }
}
