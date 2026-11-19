package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import java.util.concurrent.Executors
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ImportRunnerTest {
  private object Roomy : FreeSpace {
    override fun downloadBytes() = Long.MAX_VALUE

    override fun libraryBytes() = Long.MAX_VALUE

    override fun sameVolume() = true
  }

  private val root = Files.createTempDirectory("stemdeck-runner").toFile()
  private val scheduler = Executors.newSingleThreadScheduledExecutor()

  @After
  fun tearDown() {
    scheduler.shutdownNow()
    root.deleteRecursively()
  }

  private fun runner(queue: ImportQueue, sink: SnapshotSink) =
    ImportRunner(
      queue,
      StemDeckHttp(TlsContexts(TlsContexts.systemTrustManager())),
      DownloadFiles(File(root, DownloadFiles.DIR_NAME)),
      DownloadSpace(Roomy),
      { TrustPolicy.System },
      sink,
      scheduler,
    )

  @Test
  fun `a stopped import is not cleared until its run has ended`() {
    val queue = ImportQueue().apply { assertTrue(start(NOT_AN_ORIGIN, listOf(SONG))) }
    val duringRun = mutableListOf<Boolean>()
    lateinit var runner: ImportRunner
    runner = runner(queue) { snapshot, _ -> if (!snapshot.running) duringRun += runner.clear() }
    runner.run()
    assertEquals(listOf(false), duringRun)
    assertEquals(StemDeckFailure.BAD_ADDRESS, queue.snapshot().stopReason)
    assertTrue(runner.clear())
    assertFalse(runner.clear())
  }

  companion object {
    private const val NOT_AN_ORIGIN = "not an origin"
    private val SONG = ImportItem("aaaaaaaaaaaa", "Way Maker", emptyList())
  }
}
