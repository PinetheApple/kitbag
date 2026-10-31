package com.kitbag.corenative.route

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EnginePollTest {
  @Test
  fun `polls once a second from the start while the engine has a device`() {
    val poll = EnginePoll()
    poll.start(now = 5_000, deviceId = 7)
    assertEquals(6_000L, poll.nextPollAt)
    assertFalse(poll.onPoll(now = 6_000, deviceId = 7))
    assertEquals(7_000L, poll.nextPollAt)
  }

  @Test
  fun `a device id change reports a change and keeps polling`() {
    val poll = EnginePoll()
    poll.start(now = 0, deviceId = 7)
    assertTrue(poll.onPoll(now = 1_000, deviceId = 9))
    assertFalse(poll.onPoll(now = 2_000, deviceId = 9))
    assertEquals(3_000L, poll.nextPollAt)
  }

  @Test
  fun `losing the device reports the change and backs off to five seconds`() {
    val poll = EnginePoll()
    poll.start(now = 0, deviceId = 7)
    assertTrue(poll.onPoll(now = 1_000, deviceId = null))
    assertEquals(6_000L, poll.nextPollAt)
  }

  @Test
  fun `null stays at the five second cadence`() {
    val poll = EnginePoll()
    poll.start(now = 0, deviceId = null)
    assertEquals(1_000L, poll.nextPollAt)
    assertFalse(poll.onPoll(now = 1_000, deviceId = null))
    assertEquals(6_000L, poll.nextPollAt)
    assertFalse(poll.onPoll(now = 6_000, deviceId = null))
    assertEquals(11_000L, poll.nextPollAt)
  }

  @Test
  fun `null, then an id appears with no start call, triggers a settle and returns to one second`() {
    val poll = EnginePoll()
    poll.start(now = 0, deviceId = 7)
    poll.onPoll(now = 1_000, deviceId = null)
    val nextAt = checkNotNull(poll.nextPollAt)
    assertTrue(poll.onPoll(now = nextAt, deviceId = 9))
    assertEquals(nextAt + 1_000L, poll.nextPollAt)
  }

  @Test
  fun `a restart reseeds the device so the first poll compares against it`() {
    val poll = EnginePoll()
    poll.start(now = 0, deviceId = 7)
    poll.onPoll(now = 1_000, deviceId = null)
    poll.start(now = 2_000, deviceId = 9)
    assertEquals(3_000L, poll.nextPollAt)
    assertFalse(poll.onPoll(now = 3_000, deviceId = 9))
  }

  @Test
  fun `stop ends polling`() {
    val poll = EnginePoll()
    poll.start(now = 0, deviceId = null)
    poll.onPoll(now = 1_000, deviceId = null)
    poll.stop()
    assertNull(poll.nextPollAt)
  }

  @Test
  fun `an unstarted poll has nothing to read`() {
    assertNull(EnginePoll().nextPollAt)
  }
}
