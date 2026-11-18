package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class ImportJournalTest {
  private lateinit var root: File
  private lateinit var journal: ImportJournal

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stemdeck-journal").toFile()
    journal = ImportJournal(File(File(root, DownloadFiles.DIR_NAME), ImportJournal.FILE_NAME))
  }

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun `a saved queue loads back the same`() {
    val item = ImportItem("aaaaaaaaaaaa", "Way Maker", listOf("lead_vocals", "backing_vocals"))
    val snapshot = ImportSnapshot(
      "https://192.168.1.50:8443",
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
  fun `a missing or damaged journal loads as nothing`() {
    assertNull(journal.load())
    journal.save(ImportSnapshot.EMPTY)
    File(File(root, DownloadFiles.DIR_NAME), ImportJournal.FILE_NAME).writeText("{\"items\":[{\"jobId\":\"../x\"}]}")
    assertNull(journal.load())
  }
}
