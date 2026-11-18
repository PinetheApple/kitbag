package com.kitbag.corenative.stemdeck

import com.kitbag.corenative.library.BundleFixtures
import com.kitbag.corenative.library.StemBundleImporter
import com.kitbag.corenative.library.WaveformSidecarWriter
import com.kitbag.corenative.library.ZipBundleSource
import java.io.File
import java.net.Socket
import java.net.URI
import java.nio.file.Files
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import kotlin.random.Random
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FetchThenImportTest {
  private class Volumes(var free: Long) : FreeSpace {
    override fun downloadBytes() = free

    override fun libraryBytes() = free

    override fun sameVolume() = true
  }

  private lateinit var root: File
  private lateinit var files: DownloadFiles
  private lateinit var base: File
  private val volumes = Volumes(Long.MAX_VALUE / 4)
  private val scheduler = Executors.newSingleThreadScheduledExecutor()
  private val servers = mutableListOf<FakeStemDeckServer>()
  private val seen = CopyOnWriteArrayList<ImportSnapshot>()
  private val stems = listOf("vocals", "drums")
  private val a = ImportItem("aaaaaaaaaaaa", "Way Maker", stems)
  private val b = ImportItem("bbbbbbbbbbbb", "Gratitude", emptyList())
  private val timing = RunnerTiming(
    headersTimeoutMillis = 5000,
    stallMillis = 300,
    settleMillis = 2000,
    watchdogTickMillis = 50,
    progressIntervalMillis = 0,
    chunkBytes = 7,
  )

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stemdeck-fetch").toFile()
    files = DownloadFiles(File(root, DownloadFiles.DIR_NAME))
    base = File(root, "library").apply { mkdirs() }
  }

  @After
  fun tearDown() {
    servers.forEach { it.close() }
    scheduler.shutdownNow()
    root.deleteRecursively()
  }

  private fun server(key: TestKey? = null, respond: (String, Socket) -> Unit) =
    FakeStemDeckServer(key?.serverContext(), respond = respond).also { servers += it }

  private fun zipServer(bytes: ByteArray, sendBytes: Int = bytes.size, thenWait: Long = 0, key: TestKey? = null) =
    server(key) { _, socket ->
      FakeStemDeckServer.reply(socket, 200, bytes, contentType = "application/zip", sendBytes = sendBytes)
      Thread.sleep(thenWait)
    }

  private fun runner(
    queue: ImportQueue,
    policy: TrustPolicy = TrustPolicy.System,
    onAdding: (ImportRunner, ItemState) -> Unit = { _, _ -> },
  ): ImportRunner {
    lateinit var runner: ImportRunner
    val sink = SnapshotSink { snapshot, _ ->
      seen += snapshot
      snapshot.items.firstOrNull { it.state == ItemState.ADDING && it.fileUri != null }?.let { onAdding(runner, it) }
    }
    runner = ImportRunner(
      queue,
      StemDeckHttp(TlsContexts(TlsContexts.systemTrustManager()), allowsPlain = { true }),
      files,
      DownloadSpace(volumes, marginBytes = 0),
      { policy },
      sink,
      scheduler,
      timing,
    )
    return runner
  }

  private fun queue(origin: ServerOrigin, vararg items: ImportItem) =
    ImportQueue().apply { assertTrue(start(origin.canonical, items.toList())) }

  private fun importer() =
    StemBundleImporter(base, MAX_STEMS, { Long.MAX_VALUE }, WaveformSidecarWriter { _, _, _ -> null }) { _, _ -> }

  private fun leftovers() = files.dir.list()?.filter { it != ImportJournal.FILE_NAME }.orEmpty()

  private fun ImportQueue.single() = snapshot().items.single()

  @Test
  fun `a fetched bundle goes through the existing import and its download is removed`() {
    val bundle = BundleFixtures.bundle(stems)
    val server = zipServer(bundle)
    val queue = queue(server.origin, a)
    runner(queue) { runner, item ->
      val zip = File(URI(item.fileUri!!))
      assertTrue(DownloadFiles.isHandOff(zip, files.dir))
      importer().import(ZipBundleSource(zip.length()) { zip.inputStream() })
      assertTrue(runner.settle(item.item.jobId, SettleOutcome.ADDED))
    }.run()
    assertEquals(ItemState.ADDED, queue.single().state)
    assertEquals(listOf("drums.flac", "vocals.flac"), BundleFixtures.listTree(File(base, "stems/job123")))
    assertEquals(emptyList<String>(), leftovers())
    assertFalse(queue.snapshot().running)
  }

  @Test
  fun `the request names the lanes and never a mix`() {
    val server = zipServer(BundleFixtures.bundle(stems))
    runner(queue(server.origin, a, b)) { runner, item -> runner.settle(item.item.jobId, SettleOutcome.ADDED) }.run()
    assertEquals(
      listOf(
        "GET /api/jobs/aaaaaaaaaaaa/bundle.zip?stems=vocals,drums HTTP/1.1",
        "GET /api/jobs/bbbbbbbbbbbb/bundle.zip HTTP/1.1",
      ),
      server.requests,
    )
  }

  @Test
  fun `a large body streams through a small buffer unchanged`() {
    val body = Random(7).nextBytes(100_000)
    val server = zipServer(body)
    var received = ByteArray(0)
    runner(queue(server.origin, a)) { runner, item ->
      received = File(URI(item.fileUri!!)).readBytes()
      runner.settle(item.item.jobId, SettleOutcome.ADDED)
    }.run()
    assertArrayEquals(body, received)
    assertTrue(seen.any { it.items.single().state == ItemState.DOWNLOADING && it.items.single().bytesDone in 1L until body.size.toLong() })
  }

  @Test
  fun `a connection dropped mid-body fails the song, deletes the part and starts nothing else`() {
    val bundle = BundleFixtures.bundle(stems)
    val server = zipServer(bundle, sendBytes = bundle.size / 2)
    val queue = queue(server.origin, a, b)
    runner(queue).run()
    val snapshot = queue.snapshot()
    assertEquals(StemDeckFailure.DROPPED, snapshot.items[0].failure)
    assertEquals(ItemState.NOT_STARTED, snapshot.items[1].state)
    assertEquals(StemDeckFailure.DROPPED, snapshot.stopReason)
    assertEquals(emptyList<String>(), leftovers())
    assertEquals(1, server.requests.size)
  }

  @Test
  fun `a body that stops arriving is dropped after the stall limit, not the preparing wait`() {
    val bundle = BundleFixtures.bundle(stems)
    val server = zipServer(bundle, sendBytes = bundle.size / 2, thenWait = 5000, key = TestKey.A)
    val queue = queue(server.origin, a)
    val started = System.currentTimeMillis()
    runner(queue, TrustPolicy.Pinned(TestKey.A.fingerprint)).run()
    assertTrue(System.currentTimeMillis() - started < timing.headersTimeoutMillis)
    assertEquals(StemDeckFailure.DROPPED, queue.single().failure)
    assertEquals(emptyList<String>(), leftovers())
  }

  @Test
  fun `a bundle that does not fit is refused before a byte is written`() {
    val bundle = BundleFixtures.bundle(stems)
    volumes.free = bundle.size.toLong()
    val queue = queue(zipServer(bundle).origin, a)
    runner(queue).run()
    val item = queue.single()
    assertEquals(StemDeckFailure.NO_SPACE, item.failure)
    assertEquals(2L * bundle.size to bundle.size.toLong(), item.bytesTotal to item.bytesFree)
    assertEquals(emptyList<String>(), leftovers())
  }

  @Test
  fun `a song StemDeck no longer has fails alone and the next one comes in`() {
    val bundle = BundleFixtures.bundle(stems)
    val server = server { head, socket ->
      if (head.contains(a.jobId)) FakeStemDeckServer.reply(socket, 404, "{}".toByteArray())
      else FakeStemDeckServer.reply(socket, 200, bundle, contentType = "application/zip")
    }
    val queue = queue(server.origin, a, b)
    runner(queue) { runner, item -> runner.settle(item.item.jobId, SettleOutcome.ADDED) }.run()
    assertEquals(listOf(ItemState.FAILED, ItemState.ADDED), queue.snapshot().items.map { it.state })
    assertEquals(StemDeckFailure.NOT_FOUND, queue.snapshot().items[0].failure)
  }

  @Test
  fun `cancelling while StemDeck prepares stops at once and leaves nothing`() {
    val server = server { _, _ -> Thread.sleep(4000) }
    val queue = queue(server.origin, a, b)
    val runner = runner(queue)
    val run = Executors.newSingleThreadExecutor().submit { runner.run() }
    while (server.requests.isEmpty()) Thread.sleep(10)
    runner.cancel()
    run.get()
    assertEquals(StemDeckFailure.CANCELLED, queue.snapshot().stopReason)
    assertEquals(listOf(ItemState.NOT_STARTED, ItemState.NOT_STARTED), queue.snapshot().items.map { it.state })
    assertEquals(emptyList<String>(), leftovers())
  }

  @Test
  fun `cancelling mid-body stops at once and deletes the part`() {
    val bundle = BundleFixtures.bundle(stems)
    val server = zipServer(bundle, sendBytes = bundle.size / 2, thenWait = 4000, key = TestKey.A)
    val queue = queue(server.origin, a)
    val runner = runner(queue, TrustPolicy.Pinned(TestKey.A.fingerprint))
    val run = Executors.newSingleThreadExecutor().submit { runner.run() }
    while (seen.none { it.items.single().bytesDone > 0 }) Thread.sleep(10)
    val cancelledAt = System.currentTimeMillis()
    runner.cancel()
    run.get()
    assertTrue(System.currentTimeMillis() - cancelledAt < timing.stallMillis)
    assertEquals(StemDeckFailure.CANCELLED, queue.snapshot().stopReason)
    assertEquals(emptyList<String>(), leftovers())
  }

  @Test
  fun `a download nobody settles expires as not added and is deleted`() {
    val queue = queue(zipServer(BundleFixtures.bundle(stems)).origin, a)
    runner(queue).run()
    assertEquals(StemDeckFailure.NOT_ADDED, queue.single().failure)
    assertEquals(emptyList<String>(), leftovers())
  }

  @Test
  fun `the time limit stays the reason when a kill follows it`() {
    val server = server { _, _ -> Thread.sleep(4000) }
    val queue = queue(server.origin, a, b)
    val runner = runner(queue)
    val run = Executors.newSingleThreadExecutor().submit { runner.run() }
    while (server.requests.isEmpty()) Thread.sleep(10)
    runner.abort(StemDeckFailure.TIME_LIMIT)
    runner.abort(StemDeckFailure.INTERRUPTED)
    run.get()
    assertEquals(StemDeckFailure.TIME_LIMIT, queue.snapshot().stopReason)
    assertEquals(StemDeckFailure.TIME_LIMIT, queue.snapshot().items[0].failure)
  }

  companion object {
    private const val MAX_STEMS = 16
  }
}
