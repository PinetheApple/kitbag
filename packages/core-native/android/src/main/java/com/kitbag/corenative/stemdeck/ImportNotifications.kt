package com.kitbag.corenative.stemdeck

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.kitbag.corenative.R

class ImportNotifications(private val context: Context) {
  private val manager = NotificationManagerCompat.from(context)

  fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.kitbag_imports_channel),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  fun running(notice: ImportNotice.Running): Notification {
    val percent = notice.percent
    val text = context.getString(R.string.kitbag_stemdeck_song_phase, notice.title, phase(notice.phase, percent))
    val cancel = serviceIntent(StemDeckImportService.ACTION_CANCEL, foreground = false)
    return builder()
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentTitle(context.getString(R.string.kitbag_stemdeck_importing, notice.position, notice.total))
      .setContentText(text)
      .setProgress(ImportNotificationModel.PERCENT, percent ?: 0, percent == null)
      .addAction(0, context.getString(R.string.kitbag_stemdeck_cancel), cancel)
      .build()
  }

  fun starting(): Notification =
    builder()
      .setOngoing(true)
      .setContentTitle(context.getString(R.string.kitbag_stemdeck_phase_preparing))
      .setProgress(ImportNotificationModel.PERCENT, 0, true)
      .build()

  fun update(notification: Notification) = post(notification)

  fun result(notice: ImportNotice) {
    when (notice) {
      is ImportNotice.Finished -> post(finished(notice))
      is ImportNotice.Stopped -> post(stopped(notice))
      else -> Unit
    }
  }

  fun retryBlocked(added: Int, total: Int) =
    post(
      builder()
        .setAutoCancel(true)
        .setContentTitle(context.getString(R.string.kitbag_stemdeck_stopped_time, added, total))
        .setContentText(context.getString(R.string.kitbag_stemdeck_hint_time))
        .build(),
    )

  private fun finished(notice: ImportNotice.Finished): Notification {
    val left = notice.left
    val title = if (left == null) {
      context.resources.getQuantityString(R.plurals.kitbag_stemdeck_finished, notice.added, notice.added)
    } else {
      context.getString(R.string.kitbag_stemdeck_finished_partly, notice.added, notice.added + left.count)
    }
    val builder = builder().setAutoCancel(true).setContentTitle(title)
    if (left == null) return builder.setContentText(context.getString(R.string.kitbag_stemdeck_from)).build()
    return expanded(builder, leftText(left)).addAction(retryAction(left.count)).build()
  }

  private fun stopped(notice: ImportNotice.Stopped): Notification {
    val (titleId, hintId) = reasonText(notice.reason)
    val builder = builder()
      .setAutoCancel(true)
      .setContentTitle(context.getString(titleId, notice.added, notice.total))
    val text = leftText(notice.left) + hintId?.let { " " + context.getString(it) }.orEmpty()
    expanded(builder, text)
    if (notice.canRetry) builder.addAction(retryAction(notice.left.count))
    return builder.build()
  }

  private fun reasonText(reason: String): Pair<Int, Int?> =
    when (reason) {
      StemDeckFailure.DROPPED, StemDeckFailure.UNREACHABLE, StemDeckFailure.TIMED_OUT ->
        R.string.kitbag_stemdeck_stopped_connection to R.string.kitbag_stemdeck_hint_connection
      StemDeckFailure.NO_SPACE -> R.string.kitbag_stemdeck_stopped_space to R.string.kitbag_stemdeck_hint_space
      StemDeckFailure.TIME_LIMIT -> R.string.kitbag_stemdeck_stopped_time to R.string.kitbag_stemdeck_hint_time
      else -> R.string.kitbag_stemdeck_stopped_other to null
    }

  private fun leftText(left: ImportNotice.Left): String =
    if (left.others == 0) {
      context.getString(R.string.kitbag_stemdeck_left_one, left.firstTitle)
    } else {
      context.resources.getQuantityString(R.plurals.kitbag_stemdeck_left_more, left.others, left.firstTitle, left.others)
    }

  private fun expanded(builder: NotificationCompat.Builder, text: String) =
    builder.setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text))

  private fun retryAction(count: Int) =
    NotificationCompat.Action(
      0,
      context.resources.getQuantityString(R.plurals.kitbag_stemdeck_retry, count, count),
      serviceIntent(StemDeckImportService.ACTION_RETRY, foreground = true),
    )

  private fun phase(phase: String, percent: Int?): String =
    when {
      phase == ItemState.DOWNLOADING && percent != null ->
        context.getString(R.string.kitbag_stemdeck_phase_downloading_percent, percent)
      phase == ItemState.DOWNLOADING -> context.getString(R.string.kitbag_stemdeck_phase_downloading)
      phase == ItemState.ADDING -> context.getString(R.string.kitbag_stemdeck_phase_importing)
      else -> context.getString(R.string.kitbag_stemdeck_phase_preparing)
    }

  private fun builder(): NotificationCompat.Builder =
    NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.kitbag_notification)
      .setSilent(true)
      .setContentIntent(launchIntent())

  // Without the permission Android 13+ drops the post; the import itself does not depend on it.
  private fun post(notification: Notification) {
    try {
      if (manager.areNotificationsEnabled()) manager.notify(NOTIFICATION_ID, notification)
    } catch (e: SecurityException) {
      Log.w(STEMDECK_LOG_TAG, "Import notification not posted", e)
    }
  }

  private fun launchIntent(): PendingIntent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }

  // Retry starts a stopped service, so it must come up in the foreground; Cancel reaches one already there.
  private fun serviceIntent(action: String, foreground: Boolean): PendingIntent {
    val intent = Intent(context, StemDeckImportService::class.java).setAction(action)
    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    return if (foreground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      PendingIntent.getForegroundService(context, action.hashCode(), intent, flags)
    } else {
      PendingIntent.getService(context, action.hashCode(), intent, flags)
    }
  }

  companion object {
    const val CHANNEL_ID = "kitbag_imports"
    const val NOTIFICATION_ID = 2
  }
}
