package com.kitbag.corenative.transport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class PracticeClockTest {
  @Test
  fun `a pause banks the stretch and a resume starts a new one`() {
    val playing = PracticeClock.IDLE.afterPlaying(true, now = 1_000)
    val paused = playing.afterPlaying(false, now = 4_000)
    assertEquals(PracticeClock(3_000, null), paused)
    assertEquals(PracticeClock(3_000, 9_000), paused.afterPlaying(true, now = 9_000))
    assertEquals(5_000, paused.afterPlaying(true, now = 9_000).elapsedMillis(11_000))
  }

  @Test
  fun `a repeated play or pause changes nothing`() {
    val playing = PracticeClock(2_000, 1_000)
    assertSame(playing, playing.afterPlaying(true, now = 5_000))
    assertSame(PracticeClock.IDLE, PracticeClock.IDLE.afterPlaying(false, now = 5_000))
  }

  @Test
  fun `a wall clock stepping backwards never makes time negative`() {
    assertEquals(2_000, PracticeClock(2_000, 10_000).elapsedMillis(now = 4_000))
  }
}
