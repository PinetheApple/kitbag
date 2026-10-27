package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AnalysisStoreTest {
  private lateinit var dir: File
  private lateinit var store: AnalysisStore

  @Before
  fun setUp() {
    dir = Files.createTempDirectory("analysis-store").toFile()
    store = AnalysisStore(File(dir, "results"))
  }

  @After
  fun tearDown() {
    dir.deleteRecursively()
  }

  private fun analysed(path: String) =
    AnalysisResult(path, true, "", 121.5f, floatArrayOf(0.25f, 0.75f, 1.25f), intArrayOf(0, 2), "waves/a.kwav")

  @Test
  fun `a stored result reads back field for field`() {
    store.save(analysed("songs/1/a.mp3"))
    val read = store.pending().single()
    assertEquals("songs/1/a.mp3", read.relativePath)
    assertTrue(read.ok)
    assertEquals("", read.error)
    assertEquals(121.5f, read.bpm)
    assertArrayEquals(floatArrayOf(0.25f, 0.75f, 1.25f), read.beats, 0f)
    assertArrayEquals(intArrayOf(0, 2), read.downbeats)
    assertEquals("waves/a.kwav", read.waveformRelativePath)
  }

  @Test
  fun `a failed result reads back with its error and no beats`() {
    store.save(AnalysisResult.failed("songs/é ü.mp3", "boom"))
    val read = store.pending().single()
    assertFalse(read.ok)
    assertEquals("boom", read.error)
    assertEquals("songs/é ü.mp3", read.relativePath)
    assertEquals(0, read.beats.size)
  }

  @Test
  fun `saving again replaces the song's result and acknowledging removes it`() {
    store.save(AnalysisResult.failed("a.mp3", "first"))
    store.save(analysed("a.mp3"))
    store.save(analysed("b.mp3"))
    assertEquals(setOf("a.mp3", "b.mp3"), store.pending().map { it.relativePath }.toSet())
    assertTrue(store.pending().first { it.relativePath == "a.mp3" }.ok)
    store.remove("a.mp3")
    assertEquals(listOf("b.mp3"), store.pending().map { it.relativePath })
  }

  @Test
  fun `a corrupt result file is dropped rather than failing the read`() {
    store.save(analysed("a.mp3"))
    File(dir, "results/${AnalysisStore.fileStem("b.mp3")}.result").writeBytes(byteArrayOf(0, 0, 0, 9))
    assertEquals(listOf("a.mp3"), store.pending().map { it.relativePath })
    assertEquals(1, File(dir, "results").list()!!.size)
  }

  @Test
  fun `names are stable per path and distinct across paths`() {
    assertEquals(AnalysisStore.uniqueWorkName("a.mp3"), AnalysisStore.uniqueWorkName("a.mp3"))
    assertNotEquals(AnalysisStore.uniqueWorkName("a.mp3"), AnalysisStore.uniqueWorkName("b.mp3"))
    assertEquals(64, AnalysisStore.fileStem("songs/../x").length)
    assertTrue(AnalysisStore.fileStem("songs/../x").all { it in '0'..'9' || it in 'a'..'f' })
  }

  @Test
  fun `a run stores the analysis and leaves no running marker`() {
    val result = AnalysisRun.execute(store, "a.mp3", { false }) { analysed("a.mp3") }
    assertTrue(result!!.ok)
    assertTrue(store.pending().single().ok)
    assertEquals(0, store.interruptedAttempts("a.mp3"))
  }

  @Test
  fun `the marker counts the attempt exactly while the core runs`() {
    var during = -1
    AnalysisRun.execute(store, "a.mp3", { false }) {
      during = store.interruptedAttempts("a.mp3")
      analysed("a.mp3")
    }
    assertEquals(1, during)
  }

  @Test
  fun `one interrupted run is retried`() {
    store.markRunning("a.mp3", 1)
    var during = -1
    val result = AnalysisRun.execute(store, "a.mp3", { false }) {
      during = store.interruptedAttempts("a.mp3")
      analysed("a.mp3")
    }
    assertTrue(result!!.ok)
    assertEquals(2, during)
  }

  @Test
  fun `the second interruption fails the song without analysing`() {
    store.markRunning("a.mp3", AnalysisRun.MAX_INTERRUPTED_ATTEMPTS)
    var analysed = false
    val result = AnalysisRun.execute(store, "a.mp3", { false }) { analysed = true; analysed("a.mp3") }
    assertFalse(analysed)
    assertEquals(AnalysisFailure.INTERRUPTED, result!!.error)
    assertEquals(AnalysisFailure.INTERRUPTED, store.pending().single().error)
    assertEquals(0, store.interruptedAttempts("a.mp3"))
  }

  @Test
  fun `a failure carries its category, never the raw message`() {
    val cases = mapOf(
      MissingSongException() to AnalysisFailure.MISSING_FILE,
      UnsafeLibraryPathException("../x") to AnalysisFailure.MISSING_FILE,
      UnsupportedAudioException() to AnalysisFailure.UNSUPPORTED,
      AnalysisCoreException(5) to AnalysisFailure.INTERNAL,
      IllegalStateException("/data/user/0/secret") to AnalysisFailure.INTERNAL,
    )
    for ((error, expected) in cases) {
      var logged: Throwable? = null
      val result = AnalysisRun.execute(store, "a.mp3", { false }, { logged = it }) { throw error }
      assertEquals(expected, result!!.error)
      assertEquals(expected, store.pending().single().error)
      assertSame(error, logged)
      assertEquals(0, store.interruptedAttempts("a.mp3"))
    }
  }

  @Test
  fun `a run stopped before or during analysis stores nothing`() {
    assertNull(AnalysisRun.execute(store, "a.mp3", { true }) { analysed("a.mp3") })
    var stopped = false
    assertNull(AnalysisRun.execute(store, "b.mp3", { stopped }) { stopped = true; analysed("b.mp3") })
    assertTrue(store.pending().isEmpty())
    assertEquals(0, store.interruptedAttempts("b.mp3"))
  }
}
