package com.kitbag.app.service

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * SKELETON (#31) — foreground service surface for background metronome (SPEC
 * §5.6, §13.9). This is the piece §13.9 calls "the one most likely
 * underestimated": there is no RN API for it, so it must be Kotlin.
 *
 * Compile-shaped only. DEFERRED to Phase 3: the ongoing/non-dismissible
 * notification, the media-session lock-screen + headset controls, tying
 * kb_engine start/stop to this service's lifecycle rather than a React mount
 * (§13.9 point 3), and TurboModule-driven start/stop. The §5.8 acceptance test
 * — click unbroken for 30 min backgrounded with the JS thread deliberately
 * starved (§13.3) — is what proves this, and it cannot be demoed.
 */
class KitbagForegroundService : Service() {
  // No binding: the service is controlled through the TurboModule command path
  // (§13.2), started/stopped with startForegroundService/stopSelf, not bound to.
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // SKELETON (#31): must call startForeground(...) with the transport
    // notification before returning. Not implemented here — see class doc.
    return START_STICKY
  }
}
