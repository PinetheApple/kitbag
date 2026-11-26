package com.kitbag.corenative.media

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.util.Log

internal const val SESSIONS_LOG_TAG = "KitbagSessions"

data class MediaSessionInfo(
  val sessionId: String,
  val packageName: String,
  val appLabel: String,
  val title: String?,
  val artist: String?,
  val durationMs: Long?,
  val playing: Boolean,
  val positionMs: Long?,
  val positionUpdatedAtMs: Long,
  val speed: Float,
)

internal fun <T> List<T>.fromOtherApps(ownPackage: String, packageOf: (T) -> String): List<T> =
  filterNot { packageOf(it) == ownPackage }

class MediaSessionWatch(
  private val context: Context,
  private val publish: (sessions: List<MediaSessionInfo>) -> Unit,
) {
  private val handler = Handler(Looper.getMainLooper())
  private val manager = context.getSystemService(MediaSessionManager::class.java)
  private val listenerComponent = ComponentName(context, MediaListenerService::class.java)
  private val tracked = LinkedHashMap<String, Tracked>()
  private val labels = HashMap<String, String>()

  private val sessionsChanged =
    MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
      track(controllers.orEmpty())
      send()
    }

  fun start() {
    handler.post {
      manager.removeOnActiveSessionsChangedListener(sessionsChanged)
      if (!listen()) track(emptyList())
      send()
    }
  }

  fun stop() {
    handler.post {
      manager.removeOnActiveSessionsChangedListener(sessionsChanged)
      track(emptyList())
    }
  }

  fun control(id: String, command: (MediaController.TransportControls) -> Unit) {
    handler.post {
      val controller = tracked[id]?.controller
      if (controller == null) Log.w(SESSIONS_LOG_TAG, "No live media session $id") else command(controller.transportControls)
    }
  }

  private fun listen(): Boolean =
    try {
      manager.addOnActiveSessionsChangedListener(sessionsChanged, listenerComponent, handler)
      track(manager.getActiveSessions(listenerComponent))
      true
    } catch (e: SecurityException) {
      Log.w(SESSIONS_LOG_TAG, "Notification listener access is off", e)
      manager.removeOnActiveSessionsChangedListener(sessionsChanged)
      false
    }

  private fun track(controllers: List<MediaController>) {
    val next = LinkedHashMap<String, Tracked>()
    controllers.fromOtherApps(context.packageName) { it.packageName }.forEach { controller ->
      val id = idOf(controller)
      if (id !in next) next[id] = tracked.remove(id) ?: follow(id, controller)
    }
    tracked.values.forEach { it.controller.unregisterCallback(it.callback) }
    tracked.clear()
    tracked.putAll(next)
  }

  private fun follow(id: String, controller: MediaController): Tracked =
    Tracked(controller, SessionCallback(id)).also { controller.registerCallback(it.callback, handler) }

  private fun send() = publish(tracked.map { (id, entry) -> info(id, entry.controller).also(::logSession) })

  private fun logSession(session: MediaSessionInfo) {
    with(session) {
      Log.i(
        SESSIONS_LOG_TAG,
        "session id=$sessionId package=$packageName playing=$playing positionMs=$positionMs " +
          "positionUpdatedAtMs=$positionUpdatedAtMs speed=$speed " +
          "titleLength=${title?.length ?: -1} artistLength=${artist?.length ?: -1}",
      )
    }
  }

  private fun info(sessionId: String, controller: MediaController): MediaSessionInfo {
    val metadata = controller.metadata
    val state = controller.playbackState
    val packageName = controller.packageName
    val playing = state?.state == PlaybackState.STATE_PLAYING
    return MediaSessionInfo(
      sessionId = sessionId,
      packageName = packageName,
      appLabel = labelOf(packageName),
      title = metadata?.firstText(MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE),
      artist = metadata?.firstText(MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST),
      durationMs = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.takeIf { it > 0 },
      playing = playing,
      positionMs = state?.position?.takeIf { it != PlaybackState.PLAYBACK_POSITION_UNKNOWN },
      positionUpdatedAtMs = state?.lastPositionUpdateTime ?: 0L,
      speed = if (playing) state?.playbackSpeed ?: 0f else 0f,
    )
  }

  private fun MediaMetadata.firstText(vararg keys: String): String? =
    keys.firstNotNullOfOrNull { key -> getString(key)?.takeIf { it.isNotEmpty() } }

  private fun labelOf(packageName: String): String =
    labels.getOrPut(packageName) {
      val packages = context.packageManager
      try {
        packages.getApplicationLabel(packages.getApplicationInfo(packageName, 0)).toString()
      } catch (e: PackageManager.NameNotFoundException) {
        packageName
      }
    }

  private fun idOf(controller: MediaController) = "${controller.packageName}/${controller.sessionToken.hashCode()}"

  private class Tracked(val controller: MediaController, val callback: MediaController.Callback)

  private inner class SessionCallback(private val id: String) : MediaController.Callback() {
    override fun onPlaybackStateChanged(state: PlaybackState?) = send()

    override fun onMetadataChanged(metadata: MediaMetadata?) = send()

    override fun onSessionDestroyed() {
      tracked.remove(id)?.let { it.controller.unregisterCallback(it.callback) }
      send()
    }
  }
}
