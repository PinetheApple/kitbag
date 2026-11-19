package com.kitbag.corenative.library.move

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.kitbag.corenative.library.DataFolderLocation
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DataFolderMoveService : Service() {
  private lateinit var moves: DataFolderMoves
  private lateinit var notifications: MoveNotifications
  private val main = Handler(Looper.getMainLooper())
  private val worker: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, WORKER_NAME) }
  private var queued = 0
  private var stopWatching: (() -> Unit)? = null
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    moves = DataFolderMoves.get(this)
    notifications = MoveNotifications(this).also { it.createChannel() }
    stopWatching = moves.watch(::onEvent)
  }

  override fun onDestroy() {
    stopWatching?.invoke()
    releaseWakeLock()
    worker.shutdown()
    super.onDestroy()
  }

  // Not sticky: a killed move waits in its journal for the user's Resume.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> enqueue { moves.start(targetOf(intent)) }
      ACTION_RESUME -> enqueue { moves.resume() }
      ACTION_CANCEL -> cancel()
      else -> if (queued == 0) stopSelf()
    }
    return START_NOT_STICKY
  }

  // The journal survives the stop; Resume continues from it.
  override fun onTimeout(startId: Int, fgsType: Int) = end()

  // Only a running move has the notification's Cancel, and cancelling one only raises its flag.
  private fun cancel() {
    if (moves.running()) moves.cancel() else if (queued == 0) stopSelf()
  }

  private fun enqueue(job: () -> MoveOutcome) {
    if (!foreground(notifications.starting())) {
      moves.reportRefused(MoveRefusal.FOREGROUND_REFUSED)
      if (queued == 0) stopSelf()
      return
    }
    queued++
    acquireWakeLock()
    worker.execute {
      try {
        job()
      } finally {
        main.post(::jobEnded)
      }
    }
  }

  private fun jobEnded() {
    queued--
    if (queued == 0) end()
  }

  private fun end() {
    releaseWakeLock()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun onEvent(event: MoveEvent) {
    if (event !is MoveEvent.Progress) return
    val status = event.status
    val name = notifications.targetName(status.target) { uuid -> moves.folder.volume(uuid)?.description }
    notifications.update(notifications.running(status, name))
  }

  // Android 12+ refuses a foreground start from the background, and 15+ once the daily dataSync time is used.
  private fun foreground(notification: Notification): Boolean =
    try {
      ServiceCompat.startForeground(this, MoveNotifications.NOTIFICATION_ID, notification, FOREGROUND_TYPE)
      true
    } catch (e: IllegalStateException) {
      Log.w(TAG, "Move could not start in the foreground", e)
      false
    }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
      setReferenceCounted(false)
      acquire(LOCK_TIMEOUT_MILLIS)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
  }

  companion object {
    const val ACTION_START = "com.kitbag.corenative.datafolder.START"
    const val ACTION_RESUME = "com.kitbag.corenative.datafolder.RESUME"
    const val ACTION_CANCEL = "com.kitbag.corenative.datafolder.CANCEL"
    private const val EXTRA_VOLUME_UUID = "volumeUuid"
    private const val WORKER_NAME = "kitbag-data-folder-move"
    private const val WAKE_LOCK_TAG = "kitbag:data-folder-move"
    private const val LOCK_TIMEOUT_MILLIS = 6 * 60 * 60 * 1000L
    private const val FOREGROUND_TYPE = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
    private const val TAG = "KitbagDataFolderMove"

    fun start(context: Context, target: DataFolderLocation) {
      val intent = Intent(context, DataFolderMoveService::class.java).setAction(ACTION_START)
      MoveReport.volumeUuid(target)?.let { intent.putExtra(EXTRA_VOLUME_UUID, it) }
      ContextCompat.startForegroundService(context, intent)
    }

    fun resume(context: Context) {
      val intent = Intent(context, DataFolderMoveService::class.java).setAction(ACTION_RESUME)
      ContextCompat.startForegroundService(context, intent)
    }

    private fun targetOf(intent: Intent): DataFolderLocation =
      MoveReport.locationOf(intent.getStringExtra(EXTRA_VOLUME_UUID))
  }
}
