package com.kitbag.corenative

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.kitbag.corenative.media.MediaSessionInfo
import com.kitbag.corenative.media.MediaSessionWatch

class KitbagMediaSessionsModule(reactContext: ReactApplicationContext) :
  NativeKitbagMediaSessionsSpec(reactContext) {
  private val watch = MediaSessionWatch(reactContext, ::emitSessions)

  @Volatile private var wanted = false

  override fun invalidate() {
    watch.stop()
    super.invalidate()
  }

  override fun listenerEnabled(promise: Promise) {
    val context = reactApplicationContext
    val enabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    if (enabled && wanted) watch.start()
    promise.resolve(enabled)
  }

  override fun openListenerSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(intent)
  }

  override fun setWatching(watching: Boolean) {
    wanted = watching
    if (watching) watch.start() else watch.stop()
  }

  override fun play(sessionId: String) {
    watch.control(sessionId) { it.play() }
  }

  override fun pause(sessionId: String) {
    watch.control(sessionId) { it.pause() }
  }

  override fun skipToNext(sessionId: String) {
    watch.control(sessionId) { it.skipToNext() }
  }

  override fun skipToPrevious(sessionId: String) {
    watch.control(sessionId) { it.skipToPrevious() }
  }

  override fun seekTo(sessionId: String, positionMs: Double) {
    watch.control(sessionId) { it.seekTo(positionMs.toLong()) }
  }

  private fun emitSessions(sessions: List<MediaSessionInfo>) {
    emitOnSessions(
      Arguments.createMap().apply {
        putArray("sessions", Arguments.createArray().apply { sessions.forEach { pushMap(it.toMap()) } })
      },
    )
  }

  private fun MediaSessionInfo.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("sessionId", sessionId)
      putString("packageName", packageName)
      putString("appLabel", appLabel)
      putString("title", title)
      putString("artist", artist)
      if (durationMs == null) putNull("durationMs") else putDouble("durationMs", durationMs.toDouble())
      putBoolean("playing", playing)
      if (positionMs == null) putNull("positionMs") else putDouble("positionMs", positionMs.toDouble())
      putDouble("positionUpdatedAtMs", positionUpdatedAtMs.toDouble())
      putDouble("speed", speed.toDouble())
    }
}
