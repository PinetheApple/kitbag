package com.kitbag.corenative.route

object SettleSchedule {
  val READ_OFFSETS_MILLIS = longArrayOf(250L, 1_000L, 2_000L)
}

class RouteSettle(
  private var emitted: OutputRoute?,
  private val readOffsetsMillis: LongArray = SettleSchedule.READ_OFFSETS_MILLIS,
) {
  private var triggeredAt = 0L
  private var step = 0

  var pendingReadAt: Long? = null
    private set

  fun trigger(now: Long) {
    triggeredAt = now
    step = 0
    pendingReadAt = triggeredAt + readOffsetsMillis[step]
  }

  fun onRead(route: OutputRoute): OutputRoute? {
    step += 1
    pendingReadAt = readOffsetsMillis.getOrNull(step)?.let { triggeredAt + it }
    if (route == emitted) return null
    emitted = route
    return route
  }
}
