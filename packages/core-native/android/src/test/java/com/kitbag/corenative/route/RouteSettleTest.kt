package com.kitbag.corenative.route

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RouteSettleTest {
  private val speaker = OutputRoute("speaker", "Speaker", RouteKind.SPEAKER, certain = true)
  private val buds = OutputRoute("bt-a2dp:EE:FF:Buds", "Buds", RouteKind.BLUETOOTH, certain = true)

  private fun drain(settle: RouteSettle, resolve: (Long) -> OutputRoute): List<Pair<Long, OutputRoute?>> {
    val reads = mutableListOf<Pair<Long, OutputRoute?>>()
    while (true) {
      val at = settle.pendingReadAt ?: return reads
      reads += at to settle.onRead(resolve(at))
    }
  }

  @Test
  fun `reads land at 250, 1000 and 2000 ms after the trigger`() {
    val settle = RouteSettle(speaker)
    settle.trigger(now = 10_000)
    assertEquals(listOf(10_250L, 11_000L, 12_000L), drain(settle) { speaker }.map { it.first })
  }

  @Test
  fun `a burst of triggers leaves one schedule anchored on the last`() {
    val settle = RouteSettle(speaker)
    settle.trigger(now = 0)
    settle.trigger(now = 100)
    settle.trigger(now = 200)
    assertEquals(listOf(450L, 1_200L, 2_200L), drain(settle) { speaker }.map { it.first })
  }

  @Test
  fun `an unchanged route never emits and a change emits once`() {
    val settle = RouteSettle(speaker)
    settle.trigger(now = 0)
    val emitted = drain(settle) { at -> if (at < 1_000) speaker else buds }.mapNotNull { it.second }
    assertEquals(listOf(buds), emitted)
  }

  @Test
  fun `a rename or a certainty change on the same id emits`() {
    val settle = RouteSettle(buds)
    settle.trigger(now = 0)
    val renamed = buds.copy(name = "Buds Pro")
    val guessed = renamed.copy(certain = false)
    val emitted = drain(settle) { at ->
      when {
        at < 1_000 -> renamed
        else -> guessed
      }
    }.mapNotNull { it.second }
    assertEquals(listOf(renamed, guessed), emitted)
  }

  @Test
  fun `a trigger during a settle restarts the schedule`() {
    val settle = RouteSettle(speaker)
    settle.trigger(now = 0)
    settle.onRead(speaker)
    settle.trigger(now = 600)
    assertEquals(listOf(850L, 1_600L, 2_600L), drain(settle) { speaker }.map { it.first })
  }

  @Test
  fun `an untriggered settle has nothing to read`() {
    assertNull(RouteSettle(speaker).pendingReadAt)
  }

  @Test
  fun `a route a get reported becomes the baseline so the next true read emits`() {
    val settle = RouteSettle(speaker)
    assertEquals(buds, settle.observe(buds))
    settle.trigger(now = 0)
    assertEquals(listOf(speaker), drain(settle) { speaker }.mapNotNull { it.second })
  }

  @Test
  fun `a get that sees the emitted route reports no change`() {
    assertNull(RouteSettle(speaker).observe(speaker))
  }

  @Test
  fun `a get leaves a pending settle where it was`() {
    val settle = RouteSettle(speaker)
    settle.trigger(now = 0)
    settle.observe(buds)
    assertEquals(250L, settle.pendingReadAt)
  }
}
