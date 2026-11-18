package com.kitbag.corenative.stemdeck

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class StemDeckImportService : Service() {
  private lateinit var session: ImportSession
  private lateinit var notifications: ImportNotifications
  private val throttle = NoticeThrottle()
  private val main = Handler(Looper.getMainLooper())
  private val worker: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, WORKER_NAME) }
  private var looping = false
  private var destroyed = false
  private var stopObserving: (() -> Unit)? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    session = ImportSession.get(this)
    notifications = ImportNotifications(this).also { it.createChannel() }
    stopObserving = session.observe(SnapshotSink { snapshot, _ -> onSnapshot(snapshot) })
  }

  override fun onDestroy() {
    destroyed = true
    stopObserving?.invoke()
    if (looping) session.runner.abort(StemDeckFailure.INTERRUPTED)
    releaseLocks()
    worker.shutdown()
    super.onDestroy()
  }

  // Not sticky: a restarted process recovers from the journal and waits for the user.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_CANCEL -> cancel()
      ACTION_RETRY -> retry()
      else -> run()
    }
    return START_NOT_STICKY
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    session.runner.abort(StemDeckFailure.TIME_LIMIT)
    session.queue.stop(StemDeckFailure.TIME_LIMIT)
    end()
  }

  private fun cancel() {
    session.runner.cancel()
    if (!looping) stopSelf()
  }

  private fun retry() {
    if (!foreground(notifications.starting())) {
      val snapshot = session.queue.snapshot()
      notifications.retryBlocked(snapshot.items.count { it.state == ItemState.ADDED }, snapshot.items.size)
      if (!looping) stopSelf()
      return
    }
    if (session.queue.retry()) session.runner.begin()
    loop()
  }

  private fun run() {
    if (!foreground(notifications.starting())) {
      session.queue.stop(StemDeckFailure.TIME_LIMIT)
      if (!looping) stopSelf()
      return
    }
    loop()
  }

  private fun loop() {
    if (looping) return
    if (!session.queue.snapshot().running) {
      end()
      return
    }
    looping = true
    acquireLocks()
    throttle.reset()
    worker.execute {
      try {
        session.runner.run()
      } finally {
        main.post(::loopEnded)
      }
    }
  }

  private fun loopEnded() {
    looping = false
    if (destroyed) return
    if (session.queue.snapshot().running) loop() else end()
  }

  // Finished and Stopped are posted only while Kitbag is off screen; on screen the progress view says it.
  private fun end() {
    releaseLocks()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    if (!session.watching) notifications.result(ImportNotificationModel.of(session.queue.snapshot()))
    stopSelf()
  }

  private fun onSnapshot(snapshot: ImportSnapshot) {
    val notice = ImportNotificationModel.of(snapshot)
    if (notice is ImportNotice.Running && throttle.admit(notice, SystemClock.elapsedRealtime())) {
      notifications.update(notifications.running(notice))
    }
  }

  // Android 12+ refuses a foreground start from the background, and 15+ once the daily dataSync time is used.
  private fun foreground(notification: Notification): Boolean =
    try {
      ServiceCompat.startForeground(this, ImportNotifications.NOTIFICATION_ID, notification, FOREGROUND_TYPE)
      true
    } catch (e: IllegalStateException) {
      Log.w(STEMDECK_LOG_TAG, "Import could not start in the foreground", e)
      false
    }

  private fun acquireLocks() {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
      setReferenceCounted(false)
      acquire(LOCK_TIMEOUT_MILLIS)
    }
    val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    @Suppress("DEPRECATION")
    wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, WIFI_LOCK_TAG).apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  private fun releaseLocks() {
    wakeLock?.takeIf { it.isHeld }?.release()
    wifiLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
    wifiLock = null
  }

  companion object {
    const val ACTION_RUN = "com.kitbag.corenative.stemdeck.RUN"
    const val ACTION_CANCEL = "com.kitbag.corenative.stemdeck.CANCEL"
    const val ACTION_RETRY = "com.kitbag.corenative.stemdeck.RETRY"
    private const val WORKER_NAME = "kitbag-stemdeck-import"
    private const val WAKE_LOCK_TAG = "kitbag:stemdeck-import"
    private const val WIFI_LOCK_TAG = "kitbag:stemdeck-import"
    private const val LOCK_TIMEOUT_MILLIS = 6 * 60 * 60 * 1000L
    private const val FOREGROUND_TYPE = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC

    fun run(context: Context) {
      val intent = Intent(context, StemDeckImportService::class.java).setAction(ACTION_RUN)
      ContextCompat.startForegroundService(context, intent)
    }
  }
}
