package com.kitbag.corenative

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.kitbag.corenative.media.MediaListenerService
import com.kitbag.corenative.media.MediaSessionInfo
import com.kitbag.corenative.media.MediaSessionWatch

class KitbagMediaSessionsModule(reactContext: ReactApplicationContext) :
  NativeKitbagMediaSessionsSpec(reactContext) {
  private val watch = MediaSessionWatch(reactContext, ::emitSessions)

  override fun invalidate() {
    watch.stop()
    super.invalidate()
  }

  override fun listenerEnabled(promise: Promise) {
    val context = reactApplicationContext
    promise.resolve(NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName))
  }

  override fun openListenerSettings(promise: Promise) {
    promise.resolve(settingsIntents().any(::opened))
  }

  override fun setWatching(watching: Boolean) {
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

  private fun settingsIntents(): List<Intent> {
    val list = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return listOf(list)
    val component = ComponentName(reactApplicationContext, MediaListenerService::class.java)
    val detail =
      Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
        .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component.flattenToString())
    return listOf(detail, list)
  }

  private fun opened(intent: Intent): Boolean =
    try {
      reactApplicationContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (e: ActivityNotFoundException) {
      Log.w(TAG, "No screen for ${intent.action}", e)
      false
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
      putNullableDouble("durationMs", durationMs?.toDouble())
      putBoolean("playing", playing)
      putNullableDouble("positionMs", positionMs?.toDouble())
      putDouble("positionUpdatedAtMs", positionUpdatedAtMs.toDouble())
      putDouble("speed", speed.toDouble())
    }

  private fun WritableMap.putNullableDouble(key: String, value: Double?) {
    if (value == null) putNull(key) else putDouble(key, value)
  }

  private companion object {
    const val TAG = "KitbagMediaSessions"
  }
}
