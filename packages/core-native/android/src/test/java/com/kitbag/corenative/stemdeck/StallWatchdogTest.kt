package com.kitbag.corenative.stemdeck

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StallWatchdogTest {
  private var now = 0L
  private var stalls = 0
  private val watchdog = StallWatchdog(limitMillis = 60_000, now = { now }) { stalls += 1 }

  @Test
  fun `an unarmed watchdog never fires`() {
    now = 1_000_000
    watchdog.check()
    assertEquals(0, stalls)
  }

  @Test
  fun `progress keeps it quiet and a stall fires it once`() {
    watchdog.arm()
    now = 59_999
    watchdog.check()
    watchdog.progressed()
    now = 119_998
    watchdog.check()
    assertEquals(0, stalls)
    now = 119_999
    watchdog.check()
    watchdog.check()
    assertEquals(1, stalls)
    assertTrue(watchdog.fired)
  }

  @Test
  fun `a disarmed watchdog stays quiet`() {
    watchdog.arm()
    watchdog.disarm()
    now = 120_000
    watchdog.check()
    watchdog.progressed()
    watchdog.check()
    assertEquals(0, stalls)
  }
}
