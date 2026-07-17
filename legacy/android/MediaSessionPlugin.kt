package org.kitbag.app_shell

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.annotation.RequiresApi
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/** Detects active media sessions and streams track info back to Dart. */
class MediaSessionPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
    private lateinit var channel: MethodChannel
    private lateinit var eventChannel: EventChannel
    private lateinit var context: Context
    private var mediaSessionManager: MediaSessionManager? = null
    private val activeSessions = mutableListOf<MediaController>()

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        channel = MethodChannel(binding.binaryMessenger, "kitbag/media_session")
        channel.setMethodCallHandler(this)
        eventChannel = EventChannel(binding.binaryMessenger, "kitbag/media_session_events")
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getActiveSessions" -> {
                val sessions = getActiveSessions()
                result.success(sessions)
            }
            "requestPermission" -> {
                // On Android 13+ (TIRAMISU), POST_NOTIFICATIONS permission is needed
                // to detect media sessions. We can't request it directly from a plugin —
                // the Flutter side should handle this.
                result.success(true)
            }
            else -> result.notImplemented()
        }
    }

    private fun getActiveSessions(): List<Map<String, Any?>> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return emptyList()

        val sessions = mutableListOf<Map<String, Any?>>()
        try {
            val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE)
                    as? MediaSessionManager ?: return emptyList()

            val controllers = manager.getActiveSessions(
                    ComponentName(context, MediaSessionListenerService::class.java)
            )
            for (controller in controllers) {
                val meta = controller.metadata
                val state = controller.playbackState
                if (meta != null) {
                    sessions.add(mapOf(
                            "title" to (meta.getString(MediaMetadata.METADATA_KEY_TITLE) ?: ""),
                            "artist" to (meta.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: ""),
                            "album" to (meta.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: ""),
                            "duration" to (meta.getLong(MediaMetadata.METADATA_KEY_DURATION) / 1000.0),
                            "isPlaying" to (state?.state == PlaybackState.STATE_PLAYING),
                            "position" to ((state?.position ?: 0) / 1000.0),
                            "packageName" to (controller.packageName ?: "")
                    ))
                }
            }
        } catch (_: SecurityException) {
            // Missing NOTIFICATION_LISTENER permission
        }
        return sessions
    }

    /** Required for getActiveSessions() to work. Must be declared in manifest. */
    class MediaSessionListenerService : NotificationListenerService() {
        override fun onNotificationPosted(sbn: StatusBarNotification?) {}
        override fun onNotificationRemoved(sbn: StatusBarNotification?) {}
        override fun onListenerConnected() {}
    }
}
