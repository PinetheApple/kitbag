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
    fences.metronome.keep()
    fences.handOverMetronome {}
    assertEquals(RAN, fences.song.run(song) { RAN })
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
