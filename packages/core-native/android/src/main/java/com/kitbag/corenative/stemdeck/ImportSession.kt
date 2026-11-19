package com.kitbag.corenative.stemdeck

import android.content.Context
import android.os.StatFs
import android.os.SystemClock
import android.system.ErrnoException
import android.system.Os
import android.util.Log
import com.kitbag.corenative.library.DataFolder
import java.io.File
import java.io.IOException
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

internal const val STEMDECK_LOG_TAG = "KitbagStemDeck"

// One per process: the module and the service share the queue, so a JS reload never sees a second one.
class ImportSession private constructor(private val context: Context) {
  val files = DownloadFiles(File(context.filesDir, DownloadFiles.DIR_NAME))
  val servers = ServerStore(
    File(File(context.filesDir, ServerStore.DIR_NAME), ServerStore.FILE_NAME),
    System::currentTimeMillis,
  )
  // Built on first use: the module is created on the JS thread at launch, before any connection.
  val tls by lazy { TlsContexts(TlsContexts.systemTrustManager()) }
  val http by lazy { StemDeckHttp(tls) }
  val queue = ImportQueue()

  @Volatile var watching = false

  private val journal = ImportJournal(File(files.dir, ImportJournal.FILE_NAME))
  private val observers = CopyOnWriteArraySet<SnapshotSink>()
  private val scheduler = Executors.newSingleThreadScheduledExecutor(named("kitbag-stemdeck-watchdog"))
  val runner by lazy {
    ImportRunner(
      queue,
      http,
      files,
      DownloadSpace(VolumeSpace(files.dir) { DataFolder.root(context) }),
      servers::policy,
      SnapshotSink { snapshot, structural -> publish(snapshot, structural) },
      scheduler,
      RunnerTiming(),
      SystemClock::elapsedRealtime,
    )
  }

  init {
    DownloadFiles.handOffDir = files.dir
    recover()
  }

  val probe by lazy { ServerProbe({ http }, servers) }

  fun publishNow() = publish(queue.snapshot(), structural = true)

  fun clearImport(): Boolean {
    if (!runner.clear()) return false
    val saved = save(queue.snapshot())
    observers.forEach { it.publish(queue.snapshot(), structural = true) }
    ImportNotifications(context).clear()
    return saved
  }

  fun observe(sink: SnapshotSink): () -> Unit {
    observers.add(sink)
    return { observers.remove(sink) }
  }

  private fun publish(snapshot: ImportSnapshot, structural: Boolean) {
    if (structural) save(snapshot)
    observers.forEach { it.publish(snapshot, structural) }
  }

  // A process that died mid-import left a partial or unsettled download: neither may reach the library.
  private fun recover() {
    files.clearDownloads()
    val saved = journal.load() ?: return
    queue.restoreInterrupted(saved)
    save(queue.snapshot())
  }

  private fun save(snapshot: ImportSnapshot): Boolean =
    try {
      journal.save(snapshot)
      true
    } catch (e: IOException) {
      Log.w(STEMDECK_LOG_TAG, "Import queue not saved", e)
      false
    }

  private class VolumeSpace(private val download: File, private val library: () -> File) : FreeSpace {
    override fun downloadBytes() = StatFs(existing(download).path).availableBytes

    override fun libraryBytes() = StatFs(existing(library()).path).availableBytes

    override fun sameVolume(): Boolean =
      try {
        Os.stat(existing(download).path).st_dev == Os.stat(existing(library()).path).st_dev
      } catch (e: ErrnoException) {
        true
      }

    private fun existing(file: File) = generateSequence(file) { it.parentFile }.first { it.exists() }
  }

  companion object {
    @Volatile private var instance: ImportSession? = null

    fun get(context: Context): ImportSession =
      instance ?: synchronized(this) {
        instance ?: ImportSession(context.applicationContext).also { instance = it }
      }

    private fun named(name: String) = ThreadFactory { Thread(it, name).apply { isDaemon = true } }
  }
}
