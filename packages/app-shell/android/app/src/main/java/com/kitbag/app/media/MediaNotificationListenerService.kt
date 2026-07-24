package com.kitbag.app.media

import android.service.notification.NotificationListenerService

/**
 * SKELETON (#31) — media-session detection surface (SPEC §8.2, §13.9). This is
 * the Flutter-era legacy/android/MediaSessionPlugin.kt ported to a TurboModule
 * host: its NotificationListenerService reads active MediaControllers via
 * MediaSessionManager to detect what other apps are playing.
 *
 * Compile-shaped only. DEFERRED to Phase 3, per §13.9: port the correct Android
 * detection logic from the legacy plugin, and — while porting — FIX the two
 * documented lies rather than carry them (§2.3's requestPermission returning
 * success(true) unconditionally; §8.4's missing lastPositionUpdateTime /
 * playbackSpeed). The event surface here is intentionally empty until then.
 */
class MediaNotificationListenerService : NotificationListenerService() {
  // SKELETON (#31): onNotificationPosted / onListenerConnected + the
  // MediaSessionManager.OnActiveSessionsChangedListener wiring are deferred.
}
