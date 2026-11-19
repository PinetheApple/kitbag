package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class MoveJournalTest {
  private lateinit var temp: File
  private lateinit var file: File
  private lateinit var journal: MoveJournal
  private val warnings = mutableListOf<String>()

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("move-journal").toFile()
    file = File(temp, MoveJournal.FILE_NAME)
    journal = MoveJournal(file) { message, _ -> warnings.add(message) }
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  @Test
  fun `a saved move loads back unchanged`() {
    val state = MoveState(
      source = DataFolderLocation.Card("1234-ABCD"),
      target = DataFolderLocation.Internal,
      phase = MovePhase.VERIFYING,
      files = listOf(
        MoveEntry("songs/a/a.mp3", SIZE, MODIFIED, "ab12", verified = true),
        MoveEntry("stems/j/drums.wav", SIZE, MODIFIED),
      ),
      failure = MoveFailure.HASH_MISMATCH,
    )
    journal.save(state)
    assertEquals(state, journal.load())
  }

  @Test
  fun `no journal means no move`() {
    assertNull(journal.load())
  }

  @Test
  fun `a malformed journal means no move, is kept and is logged once`() {
    val bad = listOf(
      "{not json",
      "",
      "{}",
      "{\"version\":99,\"phase\":\"COPYING\"}",
      "{\"version\":1,\"phase\":\"NOPE\",\"source\":{\"kind\":\"internal\"},\"target\":{\"kind\":\"internal\"},\"files\":[]}",
      "{\"version\":1,\"phase\":\"CLEANING\",\"source\":{\"kind\":\"elsewhere\"},\"target\":{\"kind\":\"internal\"},\"files\":[]}",
      "{\"version\":1,\"phase\":\"COPYING\",\"source\":{\"kind\":\"internal\"},\"target\":{\"kind\":\"internal\"},\"failure\":\"OOPS\",\"files\":[]}",
    )
    for (contents in bad) {
      file.writeText(contents)
      assertNull(contents, journal.load())
      assertEquals(contents, file.readText())
    }
    assertEquals(1, warnings.size)
  }

  @Test
  fun `clearing removes the journal and is safe to repeat`() {
    journal.save(MoveState(DataFolderLocation.Internal, DataFolderLocation.Card("x"), MovePhase.PREFLIGHT, emptyList()))
    journal.clear()
    journal.clear()
    assertNull(journal.load())
  }

  private companion object {
    const val SIZE = 1024L
    const val MODIFIED = 1_700_000_000_000L
  }
}
