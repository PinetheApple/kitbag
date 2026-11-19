package com.kitbag.corenative.stemdeck

import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

class StallWatchdog(
  private val limitMillis: Long,
  private val now: () -> Long,
  private val onStall: () -> Unit,
) {
  private val lastProgress = AtomicLong(DISARMED)
  private val stalled = AtomicBoolean(false)

  val fired: Boolean get() = stalled.get()

  fun arm() {
    stalled.set(false)
    lastProgress.set(now())
  }

  fun progressed() {
    if (lastProgress.get() != DISARMED) lastProgress.set(now())
  }

  fun disarm() {
    lastProgress.set(DISARMED)
  }

  fun check() {
    val last = lastProgress.get()
    if (last == DISARMED || now() - last < limitMillis) return
    if (stalled.compareAndSet(false, true)) onStall()
  }

  companion object {
    private const val DISARMED = Long.MIN_VALUE
  }
}
