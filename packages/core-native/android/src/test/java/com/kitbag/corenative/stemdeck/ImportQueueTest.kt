package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImportQueueTest {
  private val origin = "https://192.168.1.50:8443"
  private val a = ImportItem("aaaaaaaaaaaa", "Way Maker", listOf("vocals", "drums"))
  private val b = ImportItem("bbbbbbbbbbbb", "Gratitude", emptyList())
  private val c = ImportItem("cccccccccccc", "Holy Forever", listOf("lead_vocals", "backing_vocals"))

  private fun queue(vararg items: ImportItem) = ImportQueue().apply { assertTrue(start(origin, items.toList())) }

  private fun ImportQueue.states() = snapshot().items.map { it.state }

  private fun ImportQueue.addNext(outcome: String = SettleOutcome.ADDED) {
    val item = next()!!.item
    downloading(item.jobId, 10)
    adding(item.jobId, "file:/x/${item.jobId}.zip")
    assertTrue(settle(item.jobId, outcome))
  }

  @Test
  fun `items run one at a time and the queue ends when none wait`() {
    val queue = queue(a, b)
    assertEquals(ItemState.PREPARING, queue.next()?.state)
    assertEquals(listOf(ItemState.PREPARING, ItemState.WAITING), queue.states())
    queue.downloading(a.jobId, 100)
    queue.progress(a.jobId, 40)
    assertEquals(40L, queue.snapshot().current?.bytesDone)
    queue.adding(a.jobId, "file:/x/a.zip")
    assertTrue(queue.settle(a.jobId, SettleOutcome.ADDED))
    queue.addNext(SettleOutcome.SKIPPED)
    assertNull(queue.next())
    assertFalse(queue.snapshot().running)
    assertNull(queue.snapshot().stopReason)
    assertEquals(listOf(ItemState.ADDED, ItemState.SKIPPED), queue.states())
  }

  @Test
  fun `a second start, an empty start and duplicates are refused`() {
    val queue = queue(a, a, b)
    assertEquals(2, queue.snapshot().items.size)
    assertFalse(queue.start(origin, listOf(c)))
    assertFalse(ImportQueue().start(origin, emptyList()))
  }

  @Test
  fun `a song failure moves on, a connection failure stops the rest`() {
    val queue = queue(a, b, c)
    queue.next()
    queue.fail(a.jobId, StemDeckFailure.NOT_FOUND)
    assertTrue(queue.snapshot().running)
    queue.next()
    queue.fail(b.jobId, StemDeckFailure.DROPPED)
    val snapshot = queue.snapshot()
    assertFalse(snapshot.running)
    assertEquals(StemDeckFailure.DROPPED, snapshot.stopReason)
    assertEquals(listOf(ItemState.FAILED, ItemState.FAILED, ItemState.NOT_STARTED), queue.states())
    assertNull(queue.next())
  }

  @Test
  fun `no space records what was needed and what was free`() {
    val queue = queue(a)
    queue.next()
    queue.fail(a.jobId, StemDeckFailure.NO_SPACE, bytesNeeded = 82, bytesFree = 40)
    val item = queue.snapshot().items.single()
    assertEquals(82L to 40L, item.bytesTotal to item.bytesFree)
  }

  @Test
  fun `cancelling keeps added songs, lets the one being added finish and starts nothing else`() {
    val queue = queue(a, b, c)
    queue.addNext()
    val adding = queue.next()!!.item
    queue.downloading(adding.jobId, 10)
    queue.adding(adding.jobId, "file:/x/b.zip")
    queue.stop(StemDeckFailure.CANCELLED)
    assertEquals(listOf(ItemState.ADDED, ItemState.ADDING, ItemState.NOT_STARTED), queue.states())
    assertTrue(queue.settle(b.jobId, SettleOutcome.ADDED))
    assertNull(queue.next())
  }

  @Test
  fun `a download settles once, and only while it is being added`() {
    val queue = queue(a)
    assertFalse(queue.settle(a.jobId, SettleOutcome.ADDED))
    queue.next()
    queue.adding(a.jobId, "file:/x/a.zip")
    assertTrue(queue.settle(a.jobId, SettleOutcome.REFUSED))
    assertFalse(queue.settle(a.jobId, SettleOutcome.ADDED))
    val item = queue.snapshot().items.single()
    assertEquals(ItemState.FAILED to StemDeckFailure.REFUSED, item.state to item.failure)
    assertNull(item.fileUri)
  }

  @Test
  fun `an unsettled download expires as not added and the queue goes on`() {
    val queue = queue(a, b)
    queue.next()
    queue.adding(a.jobId, "file:/x/a.zip")
    assertTrue(queue.expire(a.jobId))
    assertFalse(queue.expire(a.jobId))
    assertEquals(StemDeckFailure.NOT_ADDED, queue.snapshot().items[0].failure)
    assertEquals(b.jobId, queue.next()?.item?.jobId)
  }

  @Test
  fun `retry runs the failed and unstarted songs again`() {
    val queue = queue(a, b, c)
    queue.addNext()
    queue.next()
    queue.fail(b.jobId, StemDeckFailure.DROPPED)
    assertTrue(queue.retry())
    assertEquals(listOf(ItemState.ADDED, ItemState.WAITING, ItemState.WAITING), queue.states())
    assertNull(queue.snapshot().stopReason)
    assertNull(queue.snapshot().items[1].failure)
    assertFalse(queue.retry())
  }

  @Test
  fun `a restored queue marks what was in flight as interrupted`() {
    val queue = queue(a, b, c)
    queue.addNext()
    queue.next()
    queue.downloading(b.jobId, 100)
    val restored = ImportQueue()
    restored.restoreInterrupted(queue.snapshot())
    val snapshot = restored.snapshot()
    assertFalse(snapshot.running)
    assertEquals(StemDeckFailure.INTERRUPTED, snapshot.stopReason)
    assertEquals(listOf(ItemState.ADDED, ItemState.FAILED, ItemState.NOT_STARTED), restored.states())
    assertEquals(StemDeckFailure.INTERRUPTED, snapshot.items[1].failure)
    assertTrue(restored.retry())
  }

  @Test
  fun `clearing a stopped import leaves nothing to restore after a relaunch`() {
    val queue = queue(a, b)
    queue.addNext()
    queue.next()
    queue.fail(b.jobId, StemDeckFailure.DROPPED)
    assertTrue(queue.clear())
    assertEquals(ImportSnapshot.EMPTY, queue.snapshot())
    assertFalse(queue.retry())
    val file = Files.createTempDirectory("stemdeck-clear").toFile()
    try {
      val journal = ImportJournal(File(file, ImportJournal.FILE_NAME))
      journal.save(queue.snapshot())
      val relaunched = ImportQueue()
      relaunched.restoreInterrupted(journal.load()!!)
      assertEquals(ImportSnapshot.EMPTY, relaunched.snapshot())
    } finally {
      file.deleteRecursively()
    }
  }

  @Test
  fun `clearing does nothing while songs are still coming in`() {
    val queue = queue(a, b)
    queue.next()
    assertFalse(queue.clear())
    assertEquals(listOf(ItemState.PREPARING, ItemState.WAITING), queue.states())
    queue.downloading(a.jobId, 10)
    queue.adding(a.jobId, "file:/x/a.zip")
    queue.stop(StemDeckFailure.CANCELLED)
    assertFalse(queue.clear())
    assertTrue(queue.settle(a.jobId, SettleOutcome.ADDED))
    assertTrue(queue.clear())
  }

  @Test
  fun `a retried song keeps the replace it was started with`() {
    val replaceSet = ImportItem("dddddddddddd", "Goodness", emptyList(), ReplaceChoice(ReplaceMode.REPLACE_SET, 7))
    val replaceJob = ImportItem("eeeeeeeeeeee", "Firm", emptyList(), ReplaceChoice(ReplaceMode.REPLACE_JOB))
    val queue = queue(replaceSet, replaceJob, a)
    queue.next()
    queue.downloading(replaceSet.jobId, 100)
    val restored = ImportQueue()
    restored.restoreInterrupted(queue.snapshot())
    assertTrue(restored.retry())
    val retried = generateSequence { restored.next()?.also { restored.fail(it.item.jobId, StemDeckFailure.NOT_FOUND) } }
    assertEquals(listOf(replaceSet, replaceJob, a).map { it.replace }, retried.map { it.item.replace }.toList())
  }

  @Test(expected = IllegalArgumentException::class)
  fun `a job id that is not StemDeck's is refused`() {
    ImportItem("../../etc", "x", emptyList())
  }

  @Test(expected = IllegalArgumentException::class)
  fun `a stem name that could change the query is refused`() {
    ImportItem("aaaaaaaaaaaa", "x", listOf("vocals&volumes=2"))
  }

  @Test
  fun `a later stop keeps the reason the queue first stopped for`() {
    val queue = queue(a, b)
    queue.next()
    queue.stop(StemDeckFailure.TIME_LIMIT)
    queue.stop(StemDeckFailure.INTERRUPTED)
    queue.fail(a.jobId, StemDeckFailure.DROPPED)
    assertEquals(StemDeckFailure.TIME_LIMIT, queue.snapshot().stopReason)
  }
}
