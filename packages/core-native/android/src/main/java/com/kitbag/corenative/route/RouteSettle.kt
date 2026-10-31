package com.kitbag.corenative.route

class RouteSettle(private var emitted: OutputRoute?) {
  private var triggeredAt = 0L
  private var step = 0

  var pendingReadAt: Long? = null
    private set

  fun trigger(now: Long) {
    triggeredAt = now
    step = 0
    pendingReadAt = triggeredAt + READ_OFFSETS_MILLIS[step]
  }

  fun onRead(route: OutputRoute): OutputRoute? {
    step += 1
    pendingReadAt = READ_OFFSETS_MILLIS.getOrNull(step)?.let { triggeredAt + it }
    return observe(route)
  }

  fun observe(route: OutputRoute): OutputRoute? {
    if (route == emitted) return null
    emitted = route
    return route
  }

  private companion object {
    val READ_OFFSETS_MILLIS = longArrayOf(250L, 1_000L, 2_000L)
  }
}
