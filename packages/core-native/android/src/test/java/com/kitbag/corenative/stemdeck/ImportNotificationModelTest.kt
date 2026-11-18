package com.kitbag.corenative.stemdeck

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ImportNotificationModelTest {
  private val titles = listOf("Goodness of God", "Graves into Gardens", "Way Maker", "Gratitude")
  private val items = titles.mapIndexed { i, title -> ImportItem("${'a' + i}".repeat(12), title, emptyList()) }

  private fun snapshot(vararg states: ItemState, running: Boolean = true, stopReason: String? = null) =
    ImportSnapshot("https://192.168.1.50:8443", running, stopReason, states.toList())

  private fun state(index: Int, state: String, done: Long = 0, total: Long = ItemState.UNKNOWN_BYTES) =
    ItemState(items[index], state, bytesDone = done, bytesTotal = total)

  @Test
  fun `a running import names the song in hand and its phase`() {
    val preparing = snapshot(state(0, ItemState.ADDED), state(1, ItemState.PREPARING), state(2, ItemState.WAITING))
    assertEquals(ImportNotice.Running(2, 3, titles[1], ItemState.PREPARING, null), ImportNotificationModel.of(preparing))
    val downloading = snapshot(state(0, ItemState.DOWNLOADING, done = 38, total = 82))
    assertEquals(ImportNotice.Running(1, 1, titles[0], ItemState.DOWNLOADING, 46), ImportNotificationModel.of(downloading))
    val unknownLength = snapshot(state(0, ItemState.DOWNLOADING, done = 38))
    assertEquals(null, (ImportNotificationModel.of(unknownLength) as ImportNotice.Running).percent)
    val adding = snapshot(state(0, ItemState.ADDING))
    assertEquals(ItemState.ADDING, (ImportNotificationModel.of(adding) as ImportNotice.Running).phase)
  }

  @Test
  fun `a finished import counts what was added and what was not`() {
    val all = snapshot(state(0, ItemState.ADDED), state(1, ItemState.ADDED), running = false)
    assertEquals(ImportNotice.Finished(2, null), ImportNotificationModel.of(all))
    val oneMissing = snapshot(
      state(0, ItemState.ADDED),
      ItemState(items[1], ItemState.FAILED, StemDeckFailure.NOT_FOUND),
      running = false,
    )
    assertEquals(ImportNotice.Finished(1, ImportNotice.Left(titles[1], 0)), ImportNotificationModel.of(oneMissing))
  }

  @Test
  fun `a stopped import names the first song left and offers retry`() {
    val dropped = snapshot(
      state(0, ItemState.ADDED),
      ItemState(items[1], ItemState.FAILED, StemDeckFailure.DROPPED),
      state(2, ItemState.NOT_STARTED),
      state(3, ItemState.NOT_STARTED),
      running = false,
      stopReason = StemDeckFailure.DROPPED,
    )
    val notice = ImportNotificationModel.of(dropped) as ImportNotice.Stopped
    assertEquals(ImportNotice.Left(titles[1], 2), notice.left)
    assertEquals(3, notice.left.count)
    assertEquals(1 to 4, notice.added to notice.total)
    assertTrue(notice.canRetry)
    val timedOut = dropped.copy(stopReason = StemDeckFailure.TIME_LIMIT)
    assertFalse((ImportNotificationModel.of(timedOut) as ImportNotice.Stopped).canRetry)
  }

  @Test
  fun `a cancelled or empty import shows nothing`() {
    val cancelled = snapshot(state(0, ItemState.NOT_STARTED), running = false, stopReason = StemDeckFailure.CANCELLED)
    assertEquals(ImportNotice.None, ImportNotificationModel.of(cancelled))
    assertEquals(ImportNotice.None, ImportNotificationModel.of(ImportSnapshot.EMPTY))
  }

  @Test
  fun `progress within a phase posts at most once a second, phase changes at once`() {
    val throttle = NoticeThrottle(intervalMillis = 1000)
    val at40 = ImportNotice.Running(1, 2, "Way Maker", ItemState.DOWNLOADING, 40)
    assertTrue(throttle.admit(at40, 0))
    assertFalse(throttle.admit(at40, 5000))
    assertFalse(throttle.admit(at40.copy(percent = 41), 500))
    assertTrue(throttle.admit(at40.copy(percent = 42), 1000))
    assertTrue(throttle.admit(at40.copy(phase = ItemState.ADDING, percent = null), 1001))
    assertTrue(throttle.admit(ImportNotice.Running(2, 2, "Gratitude", ItemState.PREPARING, null), 1002))
  }
}
