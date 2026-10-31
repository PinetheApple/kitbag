package com.kitbag.corenative.route

class EnginePoll {
  private var lastDeviceId: Int? = null

  var nextPollAt: Long? = null
    private set

  fun start(now: Long, deviceId: Int?) {
    lastDeviceId = deviceId
    nextPollAt = now + INTERVAL_MILLIS
  }

  fun onPoll(now: Long, deviceId: Int?): Boolean {
    val changed = deviceId != lastDeviceId
    lastDeviceId = deviceId
    nextPollAt = deviceId?.let { now + INTERVAL_MILLIS }
    return changed
  }

  fun stop() {
    nextPollAt = null
  }

  private companion object {
    const val INTERVAL_MILLIS = 1_000L
  }
}
