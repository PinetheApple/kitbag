package com.kitbag.corenative.stemdeck

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ImportLaunchTest {
  private val item = ImportItem("aaaaaaaaaaaa", "Way Maker", emptyList())

  @Test
  fun `a refused service start stops the queue it had started and says so`() {
    val queue = ImportQueue()
    var published = 0
    try {
      ImportLaunch.launch(queue, { queue.start("https://h:443", listOf(item)) }, { error("refused") }) { published += 1 }
      fail("the refusal was swallowed")
    } catch (e: StemDeckException) {
      assertEquals(StemDeckFailure.INTERRUPTED, e.code)
    }
    assertFalse(queue.snapshot().running)
    assertEquals(StemDeckFailure.INTERRUPTED, queue.snapshot().stopReason)
    assertEquals(1, published)
    assertTrue(queue.retry())
  }

  @Test
  fun `nothing starts when the queue does not change`() {
    var started = false
    val launched = ImportLaunch.launch(ImportQueue(), { false }, { started = true }) { Unit }
    assertFalse(launched)
    assertFalse(started)
  }
}
