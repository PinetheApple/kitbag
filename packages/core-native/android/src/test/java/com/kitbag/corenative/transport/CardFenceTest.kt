package com.kitbag.corenative.transport

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CardFenceTest {
  private val fence = CardFence()

  @Test
  fun `only the card last shown runs`() {
    val first = fence.issue()
    val second = fence.issue()
    assertNull(fence.run(first) { RAN })
    assertEquals(RAN, fence.run(second) { RAN })
  }

  @Test
  fun `a withdrawn card runs nothing until the next show`() {
    val shown = fence.issue()
    fence.withdraw()
    assertNull(fence.run(shown) { RAN })
    val next = fence.issue()
    assertNull(fence.run(shown) { RAN })
    assertEquals(RAN, fence.run(next) { RAN })
  }

  @Test
  fun `keep holds the live card and issues a new one only after a withdraw`() {
    val first = fence.keep()
    assertEquals(first, fence.keep())
    assertEquals(RAN, fence.run(first) { RAN })
    fence.withdraw()
    val next = fence.keep()
    assertNull(fence.run(first) { RAN })
    assertEquals(RAN, fence.run(next) { RAN })
  }

  @Test
  fun `handing the metronome over leaves song presses running`() {
    val fences = CardFences()
    val song = fences.song.issue()
    fences.showMetronome()
    fences.hideMetronome {}
    assertEquals(RAN, fences.song.run(song) { RAN })
  }

  @Test
  fun `a withdrawn card is no longer held`() {
    val shown = fence.keep()
    assertTrue(fence.holds(shown))
    fence.withdraw()
    assertFalse(fence.holds(shown))
  }

  @Test
  fun `only the newer card is held after a keep that follows a withdraw`() {
    val first = fence.keep()
    fence.withdraw()
    val next = fence.keep()
    assertFalse(fence.holds(first))
    assertTrue(fence.holds(next))
  }

  @Test
  fun `a hide withdraws the card it was sent for, and the next show gets a new card`() {
    val fences = CardFences()
    val shown = fences.showMetronome()
    fences.hideMetronome {}
    val next = fences.showMetronome()
    assertFalse(fences.metronome.holds(shown))
    assertTrue(fences.metronome.holds(next))
  }

  @Test
  fun `a card never shown runs nothing, before or after a withdraw`() {
    assertNull(fence.run(CardFence.NONE) { RAN })
    fence.withdraw()
    assertNull(fence.run(CardFence.NONE) { RAN })
  }

  @Test
  fun `a withdraw racing a running card waits for its body, and both finish`() {
    val card = fence.issue()
    val pool = Executors.newFixedThreadPool(2)
    val inBody = CountDownLatch(1)
    val bodyDone = AtomicBoolean(false)
    val withdrawnBeforeBodyDone = AtomicBoolean(false)
    try {
      val running = pool.submit {
        fence.run(card) {
          inBody.countDown()
          Thread.sleep(BODY_MILLIS)
          bodyDone.set(true)
        }
      }
      assertTrue(inBody.await(TIMEOUT_SECONDS, TimeUnit.SECONDS))
      val withdrawing = pool.submit {
        fence.withdraw()
        withdrawnBeforeBodyDone.set(!bodyDone.get())
      }
      withdrawing.get(TIMEOUT_SECONDS, TimeUnit.SECONDS)
      running.get(TIMEOUT_SECONDS, TimeUnit.SECONDS)
    } finally {
      pool.shutdownNow()
    }
    assertTrue(bodyDone.get())
    assertFalse(withdrawnBeforeBodyDone.get())
    assertNull(fence.run(card) { RAN })
  }

  private companion object {
    const val RAN = "ran"
    const val BODY_MILLIS = 200L
    const val TIMEOUT_SECONDS = 5L
  }
}
