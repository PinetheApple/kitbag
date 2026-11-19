package com.kitbag.corenative.stemdeck

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

class RunnerTiming(
  val headersTimeoutMillis: Int = HEADERS_TIMEOUT_MILLIS,
  val stallMillis: Long = STALL_MILLIS,
  val settleMillis: Long = SETTLE_MILLIS,
  val watchdogTickMillis: Long = WATCHDOG_TICK_MILLIS,
  val progressIntervalMillis: Long = PROGRESS_INTERVAL_MILLIS,
  val chunkBytes: Int = CHUNK_BYTES,
) {
  companion object {
    // StemDeck encodes every stem to FLAC before it sends the first byte.
    const val HEADERS_TIMEOUT_MILLIS = 15 * 60 * 1000
    const val STALL_MILLIS = 60_000L
    const val SETTLE_MILLIS = 10 * 60 * 1000L
    const val WATCHDOG_TICK_MILLIS = 1000L
    const val PROGRESS_INTERVAL_MILLIS = 250L
    const val CHUNK_BYTES = 64 * 1024
  }
}

fun interface SnapshotSink {
  fun publish(snapshot: ImportSnapshot, structural: Boolean)
}

private class NoSpaceException(val verdict: SpaceVerdict) : IOException("Not enough space")

class ImportRunner(
  private val queue: ImportQueue,
  private val http: StemDeckHttp,
  private val files: DownloadFiles,
  private val space: DownloadSpace,
  private val policyFor: (ServerOrigin) -> TrustPolicy,
  private val sink: SnapshotSink,
  private val scheduler: ScheduledExecutorService,
  private val timing: RunnerTiming = RunnerTiming(),
  private val clock: () -> Long = System::currentTimeMillis,
) {
  private val current = AtomicReference<StemDeckRequest?>(null)
  private val aborted = AtomicReference<String?>(null)
  private val settles = SettleGate()
  private val active = AtomicBoolean(false)

  fun begin() {
    aborted.set(null)
  }

  fun cancel() = abort(StemDeckFailure.CANCELLED)

  // The first reason stands: a kill that follows Android's time limit is still the time limit.
  fun abort(reason: String) {
    aborted.compareAndSet(null, reason)
    current.get()?.abort()
  }

  fun settle(jobId: String, outcome: String): Boolean {
    if (!queue.settle(jobId, outcome)) return false
    settles.release(jobId)
    return true
  }

  // A queue stopped from outside still hears from a run winding down, which would rewrite a cleared journal.
  fun clear(): Boolean = !active.get() && queue.clear()

  fun run() {
    active.set(true)
    try {
      val origin = queue.snapshot().origin?.let(ServerOrigin::parse)
      when {
        origin == null -> queue.stop(StemDeckFailure.BAD_ADDRESS)
        !prepared() -> queue.stop(StemDeckFailure.INTERRUPTED)
        else -> fetchAll(origin)
      }
      publish()
    } finally {
      active.set(false)
    }
  }

  private fun prepared(): Boolean =
    try {
      files.prepare()
      true
    } catch (e: IOException) {
      false
    }

  private fun fetchAll(origin: ServerOrigin) {
    while (true) {
      stopIfAborted()
      val item = queue.next() ?: return
      publish()
      fetch(origin, item.item)
      publish()
    }
  }

  private fun stopIfAborted() {
    val reason = aborted.get() ?: return
    if (queue.snapshot().running) queue.stop(reason)
  }

  private fun fetch(origin: ServerOrigin, item: ImportItem) {
    var headersReceived = false
    try {
      http.open(origin, StemDeckApi.bundlePath(item), policyFor(origin), timing.headersTimeoutMillis, ::watch)
        .use { response ->
          aborted.get()?.let { throw StemDeckException(it) }
          if (response.status != HttpURLConnection.HTTP_OK) throw http.failure(response)
          if (!response.contentType.startsWith(ZIP_TYPE)) throw StemDeckException(StemDeckFailure.HTTP_ERROR)
          headersReceived = true
          response.request.limitReads(timing.stallMillis.toInt())
          receive(item.jobId, response.body(), response.contentLength)
        }
      handOver(item.jobId, files.complete(item.jobId))
    } catch (e: NoSpaceException) {
      files.discard(item.jobId)
      queue.fail(item.jobId, StemDeckFailure.NO_SPACE, e.verdict.neededBytes, e.verdict.freeBytes)
    } catch (e: Exception) {
      files.discard(item.jobId)
      failed(item.jobId, e, headersReceived)
    } finally {
      current.set(null)
    }
  }

  private fun watch(request: StemDeckRequest) {
    current.set(request)
    aborted.get()?.let { throw StemDeckException(it) }
  }

  private fun failed(jobId: String, error: Exception, headersReceived: Boolean) {
    when (val reason = aborted.get()) {
      StemDeckFailure.CANCELLED -> queue.stop(reason)
      null -> queue.fail(jobId, StemDeckFailure.of(error, headersReceived))
      else -> queue.fail(jobId, reason)
    }
  }

  private fun receive(jobId: String, input: InputStream, length: Long) {
    if (length >= 0) space.forLength(length).takeUnless { it.fits }?.let { throw NoSpaceException(it) }
    queue.downloading(jobId, length)
    publish()
    val watchdog = StallWatchdog(timing.stallMillis, clock) { current.get()?.abort() }
    val tick = scheduler.scheduleWithFixedDelay(
      watchdog::check,
      timing.watchdogTickMillis,
      timing.watchdogTickMillis,
      TimeUnit.MILLISECONDS,
    )
    watchdog.arm()
    try {
      FileOutputStream(files.part(jobId)).use { out ->
        val written = copy(jobId, input, out, length, watchdog)
        out.fd.sync()
        if (length >= 0 && written != length) throw StemDeckException(StemDeckFailure.DROPPED)
      }
    } finally {
      tick.cancel(false)
      watchdog.disarm()
    }
  }

  private fun copy(jobId: String, input: InputStream, out: OutputStream, length: Long, watchdog: StallWatchdog): Long {
    val buffer = ByteArray(timing.chunkBytes)
    var written = 0L
    var checkedAt = 0L
    var publishedAt = clock()
    while (true) {
      aborted.get()?.let { throw StemDeckException(it) }
      val read = input.read(buffer)
      if (read < 0) return written
      out.write(buffer, 0, read)
      written += read
      watchdog.progressed()
      if (length >= 0 && written > length) throw StemDeckException(StemDeckFailure.DROPPED)
      if (length < 0 && space.recheckDue(written, checkedAt)) {
        checkedAt = written
        space.whileStreaming(written).takeUnless { it.fits }?.let { throw NoSpaceException(it) }
      }
      if (clock() - publishedAt >= timing.progressIntervalMillis) {
        publishedAt = clock()
        queue.progress(jobId, written)
        sink.publish(queue.snapshot(), structural = false)
      }
    }
  }

  private fun handOver(jobId: String, zip: File) {
    settles.expect(jobId)
    queue.adding(jobId, zip.toURI().toString())
    publish()
    val settled = settles.await(timing.settleMillis)
    files.discard(jobId)
    if (!settled) queue.expire(jobId)
  }

  private fun publish() = sink.publish(queue.snapshot(), structural = true)

  private class SettleGate {
    private var expected: String? = null
    private var latch = CountDownLatch(1)

    @Synchronized
    fun expect(jobId: String) {
      expected = jobId
      latch = CountDownLatch(1)
    }

    @Synchronized
    fun release(jobId: String) {
      if (jobId == expected) latch.countDown()
    }

    fun await(millis: Long): Boolean {
      val waiting = synchronized(this) { latch }
      return try {
        waiting.await(millis, TimeUnit.MILLISECONDS)
      } catch (e: InterruptedException) {
        Thread.currentThread().interrupt()
        false
      }
    }
  }

  companion object {
    private const val ZIP_TYPE = "application/zip"
  }
}
