package com.kitbag.corenative

import android.content.pm.PackageManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.kitbag.corenative.stemdeck.HttpText
import com.kitbag.corenative.stemdeck.ImportItem
import com.kitbag.corenative.stemdeck.ImportLaunch
import com.kitbag.corenative.stemdeck.ImportSession
import com.kitbag.corenative.stemdeck.ImportSnapshot
import com.kitbag.corenative.stemdeck.ItemState
import com.kitbag.corenative.stemdeck.KnownServer
import com.kitbag.corenative.stemdeck.ProbeResult
import com.kitbag.corenative.stemdeck.ReplaceChoice
import com.kitbag.corenative.stemdeck.ReplaceMode
import com.kitbag.corenative.stemdeck.STEMDECK_LOG_TAG
import com.kitbag.corenative.stemdeck.ServerOrigin
import com.kitbag.corenative.stemdeck.ServerProbe
import com.kitbag.corenative.stemdeck.SettleOutcome
import com.kitbag.corenative.stemdeck.SnapshotSink
import com.kitbag.corenative.stemdeck.StemDeckApi
import com.kitbag.corenative.stemdeck.StemDeckException
import com.kitbag.corenative.stemdeck.StemDeckFailure
import com.kitbag.corenative.stemdeck.StemDeckImportService
import com.kitbag.corenative.stemdeck.qr.QrScan
import com.kitbag.corenative.stemdeck.qr.QrScanLauncher
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class KitbagStemDeckModule(reactContext: ReactApplicationContext) : NativeKitbagStemDeckSpec(reactContext) {
  private val session = ImportSession.get(reactContext)
  private val io: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, IO_THREAD_NAME) }
  private val stopObserving = session.observe(SnapshotSink { snapshot, _ -> emitOnImport(snapshot.toMap()) })
  private val scanner = QrScanLauncher(reactContext).also { reactContext.addActivityEventListener(it) }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(scanner)
    scanner.cancel()
    stopObserving()
    io.shutdownNow()
    super.invalidate()
  }

  override fun probe(origin: String, promise: Promise) =
    request(promise) { session.probe.probe(parse(origin)).toMap() }

  override fun trust(origin: String, fingerprint: String?, promise: Promise) =
    request(promise) { session.servers.trust(parse(origin), fingerprint) }

  override fun forget(origin: String, promise: Promise) =
    request(promise) {
      val parsed = parse(origin)
      session.servers.forget(parsed)
      session.tls.forget(parsed)
      null
    }

  override fun knownServers(promise: Promise) =
    request(promise) { Arguments.createArray().apply { session.servers.all().forEach { pushMap(it.toMap()) } } }

  override fun getJson(origin: String, endpoint: String, promise: Promise) =
    request(promise) {
      val parsed = parse(origin)
      val path = StemDeckApi.ENDPOINTS[endpoint] ?: throw IllegalArgumentException("Unknown endpoint")
      val text = session.http.text(parsed, path, session.servers.policy(parsed), JSON_CAP_BYTES)
      session.servers.touch(parsed)
      text.toMap()
    }

  override fun startImport(origin: String, items: ReadableArray, promise: Promise) =
    request(promise) {
      val parsed = parse(origin)
      val requested = importItems(items)
      launch { session.queue.start(parsed.canonical, requested) }
    }

  override fun cancelImport() = session.runner.cancel()

  override fun retryImport(promise: Promise) = request(promise) { launch { session.queue.retry() } }

  private fun launch(change: () -> Boolean): Boolean =
    ImportLaunch.launch(
      session.queue,
      change,
      {
        session.runner.begin()
        StemDeckImportService.run(reactApplicationContext)
      },
      session::publishNow,
    )

  override fun importSnapshot(promise: Promise) = request(promise) { session.queue.snapshot().toMap() }

  override fun settleDownload(jobId: String, outcome: String) {
    if (!session.runner.settle(jobId, outcome)) Log.w(STEMDECK_LOG_TAG, "Settle of $jobId ignored: not being added")
  }

  override fun setWatching(watching: Boolean) {
    session.watching = watching
  }

  override fun scanQr(look: ReadableMap, promise: Promise) = scanner.scan(look, promise)

  private fun parse(origin: String) =
    ServerOrigin.parse(origin) ?: throw StemDeckException(StemDeckFailure.BAD_ADDRESS)

  private fun importItems(items: ReadableArray): List<ImportItem> =
    (0 until items.size()).map { index ->
      val item = items.getMap(index) ?: throw IllegalArgumentException("Missing import item")
      val stems = item.getArray(STEMS) ?: throw IllegalArgumentException("Missing stems")
      ImportItem(
        jobId = item.getString(JOB_ID).orEmpty(),
        title = item.getString(TITLE).orEmpty(),
        stems = (0 until stems.size()).map { stems.getString(it).orEmpty() },
        replace = replaceChoice(item),
      )
    }

  private fun replaceChoice(item: ReadableMap): ReplaceChoice {
    val present = item.hasKey(REPLACE_TARGET) && !item.isNull(REPLACE_TARGET)
    val target = if (present) item.getDouble(REPLACE_TARGET) else null
    return ReplaceChoice.fromBridge(item.getString(REPLACE).orEmpty(), target)
  }

  // Codes reach JS; causes carry addresses and stay in the log.
  private fun request(promise: Promise, work: () -> Any?) {
    io.execute {
      try {
        promise.resolve(work())
      } catch (e: StemDeckException) {
        Log.w(STEMDECK_LOG_TAG, e.code, e)
        promise.reject(e.code, e.code)
      } catch (e: IllegalArgumentException) {
        Log.w(STEMDECK_LOG_TAG, E_INVALID_REQUEST, e)
        promise.reject(E_INVALID_REQUEST, E_INVALID_REQUEST)
      } catch (e: Exception) {
        val code = StemDeckFailure.of(e, headersReceived = false)
        Log.w(STEMDECK_LOG_TAG, code, e)
        promise.reject(code, code)
      }
    }
  }

  private fun ProbeResult.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("trust", trust)
      putString("fingerprint", fingerprint)
      putString("previousFingerprint", previousFingerprint)
      if (health == null) putNull("health") else putMap("health", health.toMap())
    }

  private fun HttpText.toMap(): WritableMap =
    Arguments.createMap().apply {
      putInt("status", status)
      putString("contentType", contentType)
      putString("body", body)
    }

  private fun KnownServer.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("origin", origin)
      putString("fingerprint", fingerprint)
      putDouble("trustedAt", trustedAt.toDouble())
      putDouble("lastUsedAt", lastUsedAt.toDouble())
      putBoolean("plain", plain)
    }

  private fun ImportSnapshot.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("origin", origin)
      putBoolean("running", running)
      putString("stopReason", stopReason)
      putArray("items", Arguments.createArray().apply { items.forEach { pushMap(it.toMap()) } })
    }

  private fun ItemState.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("jobId", item.jobId)
      putString("title", item.title)
      putString(REPLACE, item.replace.code)
      val target = item.replace.bridgeTarget
      if (target == null) putNull(REPLACE_TARGET) else putDouble(REPLACE_TARGET, target)
      putString("state", state)
      putString("failure", failure)
      putDouble("bytesDone", bytesDone.toDouble())
      putDouble("bytesTotal", bytesTotal.toDouble())
      putDouble("bytesFree", bytesFree.toDouble())
      putString("fileUri", fileUri)
    }

  override fun getTypedExportedConstants(): Map<String, Any> =
    mapOf<String, Any>(
      "unknownBytes" to ItemState.UNKNOWN_BYTES.toDouble(),
      "hasCamera" to reactApplicationContext.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY),
    ) +
      QrScan.CONSTANTS +
      ServerProbe.CONSTANTS +
      StemDeckApi.CONSTANTS +
      ItemState.CONSTANTS +
      SettleOutcome.CONSTANTS +
      ReplaceMode.CONSTANTS +
      StemDeckFailure.CONSTANTS

  companion object {
    private const val IO_THREAD_NAME = "kitbag-stemdeck-io"
    private const val E_INVALID_REQUEST = "E_INVALID_REQUEST"
    private const val JSON_CAP_BYTES = 16 * 1024 * 1024
    private const val JOB_ID = "jobId"
    private const val TITLE = "title"
    private const val STEMS = "stems"
    private const val REPLACE = "replace"
    private const val REPLACE_TARGET = "replaceTarget"
  }
}
