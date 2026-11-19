package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ImportJournalTest {
  private lateinit var root: File
  private lateinit var journal: ImportJournal

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stemdeck-journal").toFile()
    journal = ImportJournal(file())
  }

  private fun file() = File(File(root, DownloadFiles.DIR_NAME), ImportJournal.FILE_NAME)

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun `a saved queue loads back the same`() {
    val item = ImportItem("aaaaaaaaaaaa", "Way Maker", listOf("lead_vocals", "backing_vocals"))
    val snapshot = ImportSnapshot(
      ORIGIN,
      true,
      null,
      listOf(
        ItemState(item, ItemState.FAILED, StemDeckFailure.NO_SPACE, bytesTotal = 82, bytesFree = 40),
        ItemState(ImportItem("bbbbbbbbbbbb", "Gratitude", emptyList()), ItemState.WAITING),
      ),
    )
    journal.save(snapshot)
    val loaded = journal.load()!!
    assertEquals(snapshot.copy(items = emptyList()), loaded.copy(items = emptyList()))
    assertEquals(
      snapshot.items.map { listOf(it.item.jobId, it.item.title, it.item.stems, it.state, it.failure, it.bytesTotal) },
      loaded.items.map { listOf(it.item.jobId, it.item.title, it.item.stems, it.state, it.failure, it.bytesTotal) },
    )
    assertEquals(40L, loaded.items[0].bytesFree)
  }

  @Test
  fun `an interrupted replace is retried as the same replace after a restart`() {
    val replaceSet = ReplaceChoice(ReplaceMode.REPLACE_SET, 42)
    val replaceJob = ReplaceChoice(ReplaceMode.REPLACE_JOB)
    val queue = ImportQueue()
    queue.start(
      ORIGIN,
      listOf(
        ImportItem("aaaaaaaaaaaa", "Way Maker", emptyList(), replaceSet),
        ImportItem("bbbbbbbbbbbb", "Gratitude", emptyList(), replaceJob),
        ImportItem("cccccccccccc", "Holy Forever", emptyList()),
      ),
    )
    queue.next()
    queue.downloading("aaaaaaaaaaaa", 100)
    journal.save(queue.snapshot())
    val restored = ImportQueue().apply { restoreInterrupted(journal.load()!!) }
    assertTrue(restored.retry())
    assertEquals(listOf(replaceSet, replaceJob, ReplaceChoice.ADD), restored.snapshot().items.map { it.item.replace })
  }

  @Test
  fun `a journal saved before replace choices loads its songs as plain adds`() {
    file().apply { parentFile.mkdirs() }.writeText(
      """{"origin":"$ORIGIN","running":false,"stopReason":"interrupted","items":[""" +
        """{"jobId":"aaaaaaaaaaaa","title":"Way Maker","stems":[],"state":"failed",""" +
        """"failure":"interrupted","bytesTotal":-1,"bytesFree":-1}]}""",
    )
    assertEquals(listOf(ReplaceChoice.ADD), journal.load()!!.items.map { it.item.replace })
  }

  @Test
  fun `a missing or damaged journal loads as nothing`() {
    assertNull(journal.load())
    journal.save(ImportSnapshot.EMPTY)
    file().writeText("{\"items\":[{\"jobId\":\"../x\"}]}")
    assertNull(journal.load())
  }

  private companion object {
    const val ORIGIN = "https://192.168.1.50:8443"
  }
}
