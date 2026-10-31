package com.kitbag.corenative.route

class EnginePoll {
  private var lastDeviceId: Int? = null

  var nextPollAt: Long? = null
    private set

  fun start(now: Long, deviceId: Int?) {
    lastDeviceId = deviceId
    nextPollAt = now + RUNNING_INTERVAL_MILLIS
  }

  fun onPoll(now: Long, deviceId: Int?): Boolean {
    val changed = deviceId != lastDeviceId
    lastDeviceId = deviceId
    nextPollAt = now + if (deviceId == null) IDLE_INTERVAL_MILLIS else RUNNING_INTERVAL_MILLIS
    return changed
  }

  fun stop() {
    nextPollAt = null
  }

  private companion object {
    const val RUNNING_INTERVAL_MILLIS = 1_000L
    const val IDLE_INTERVAL_MILLIS = 5_000L
  }
}
