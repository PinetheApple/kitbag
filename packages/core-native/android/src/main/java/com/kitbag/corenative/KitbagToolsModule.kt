package com.kitbag.corenative

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.kitbag.corenative.library.JsonStateFile
import com.kitbag.corenative.tools.AssetToolIndexSource
import com.kitbag.corenative.tools.BytecodeHandOff
import com.kitbag.corenative.tools.InstalledToolCheck
import com.kitbag.corenative.tools.InstalledToolLoader
import com.kitbag.corenative.tools.InstalledTools
import com.kitbag.corenative.tools.SystemToolConnector
import com.kitbag.corenative.tools.ToolBundleRules
import com.kitbag.corenative.tools.ToolCatalogue
import com.kitbag.corenative.tools.ToolCatalogueReader
import com.kitbag.corenative.tools.ToolDownloader
import com.kitbag.corenative.tools.ToolDownloads
import com.kitbag.corenative.tools.ToolInstallEvent
import com.kitbag.corenative.tools.ToolInstallRequest
import com.kitbag.corenative.tools.ToolInstaller
import com.kitbag.corenative.tools.ToolInstallerState
import com.kitbag.corenative.tools.ToolJob
import com.kitbag.corenative.tools.ToolKeyRing
import com.kitbag.corenative.tools.ToolRejected
import com.kitbag.corenative.tools.ToolRejection
import com.kitbag.corenative.tools.ToolSpace
import com.kitbag.corenative.tools.VerifiedToolHandoff
import com.kitbag.corenative.tools.reject
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

class KitbagToolsModule(reactContext: ReactApplicationContext) : NativeKitbagToolsSpec(reactContext) {
  private class Failure(val code: String, val error: Throwable)

  // A recreated module must not race the previous one's install thread, so installs and state are per process.
  private object Installs {
    val executor: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, INSTALL_THREAD_NAME) }
    val jobs = ConcurrentHashMap<String, ToolJob>()
    private var state: ToolInstallerState? = null

    @Synchronized
    fun state(file: File, rules: ToolBundleRules): ToolInstallerState =
      state ?: ToolInstallerState(
        file = JsonStateFile(file, UNREADABLE_STATE) { message, cause -> Log.w(TAG, message, cause) },
        rules = rules,
      ).also { state = it }
  }

  private val io: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, IO_THREAD_NAME) }
  private val pending = mutableSetOf<Promise>()
  private val ownJobs = ConcurrentHashMap.newKeySet<ToolJob>()
  private val rules = ToolBundleRules.bundled
  private val installed = InstalledTools(reactContext.noBackupFilesDir, rules)
  private val keys by lazy { ToolKeyRing.parse(readPins(), emptySet(), rules) }
  private val loader by lazy { InstalledToolLoader(installed, rules, { keys }, NativeHandOff) }
  private val state by lazy { Installs.state(File(installed.toolsDir, STATE_FILE), rules) }
  private val installer by lazy {
    ToolInstaller(
      installed = installed,
      rules = rules,
      keys = { keys },
      index = AssetToolIndexSource(reactContext.assets, rules),
      hostVersionCode = AppChrome.versionCode(reactContext),
      state = state,
      downloader = ToolDownloader(SystemToolConnector),
      space = ToolSpace { reactContext.noBackupFilesDir.usableSpace },
    )
  }
  private val catalogue by lazy {
    ToolCatalogueReader(
      installed = InstalledToolCheck(installed, rules) { keys },
      installer = installer,
      state = state,
    )
  }

  private object NativeHandOff : BytecodeHandOff {
    override fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int) =
      VerifiedToolHandoff.handOff(toolId, bytecode, bytecodeVersion)

    override fun drop(toolId: String): Boolean = VerifiedToolHandoff.drop(toolId)
  }

  init {
    Installs.executor.execute { guarded("clean tool staging") { installer.cleanAtStart() } }
  }

  override fun invalidate() {
    ownJobs.forEach { it.cancel() }
    io.shutdownNow()
    val unsettled = synchronized(pending) { pending.toList().also { pending.clear() } }
    for (promise in unsettled) promise.reject(ToolRejection.CANCELLED.code, TORN_DOWN)
    super.invalidate()
  }

  override fun verifyInstalled(toolId: String, promise: Promise) = submit(io, promise) {
    loader.load(toolId)
    null
  }

  override fun toolDownloads(promise: Promise) = submit(io, promise) { state.downloads().code }

  override fun setToolDownloads(downloads: String, promise: Promise) = submit(io, promise) {
    val value = ToolDownloads.ofCode(downloads) ?: reject(ToolRejection.INTERNAL, "$downloads is not a downloads state")
    installer.setDownloads(value)
    if (value != ToolDownloads.ON) Installs.jobs.values.forEach { it.cancel() }
    null
  }

  override fun toolCatalogue(promise: Promise) = submit(io, promise) { catalogue.read().toMap() }

  override fun installTool(toolId: String, allowOlder: Boolean, promise: Promise) {
    val job = ToolJob()
    if (Installs.jobs.putIfAbsent(toolId, job) != null) {
      promise.resolve(false)
      return
    }
    ownJobs += job
    try {
      Installs.executor.execute {
        try {
          guarded("install $toolId") { installer.install(ToolInstallRequest(toolId, allowOlder), job, ::emit) }
        } finally {
          Installs.jobs.remove(toolId, job)
          ownJobs -= job
        }
      }
      promise.resolve(true)
    } catch (error: RejectedExecutionException) {
      Installs.jobs.remove(toolId, job)
      ownJobs -= job
      promise.reject(ToolRejection.CANCELLED.code, TORN_DOWN, error)
    }
  }

  override fun cancelToolInstall(toolId: String) {
    Installs.jobs[toolId]?.cancel()
  }

  override fun removeTool(toolId: String, promise: Promise) = submit(Installs.executor, promise) {
    installer.remove(toolId)
    NativeHandOff.drop(toolId)
    null
  }

  private fun emit(event: ToolInstallEvent) {
    guarded("emit an install event") { emitOnToolInstall(event.toMap()) }
  }

  private fun guarded(what: String, work: () -> Unit) {
    try {
      work()
    } catch (error: Throwable) {
      Log.e(TAG, "Could not $what", error)
    }
  }

  private fun submit(executor: ExecutorService, promise: Promise, work: () -> Any?) {
    synchronized(pending) { pending += promise }
    try {
      executor.execute { settle(promise, attempt(work)) }
    } catch (error: RejectedExecutionException) {
      settle(promise, Result.failure(error))
    }
  }

  private fun attempt(work: () -> Any?): Result<Any?> =
    try {
      Result.success(work())
    } catch (error: Throwable) {
      Result.failure(error)
    }

  private fun settle(promise: Promise, result: Result<Any?>) {
    if (!synchronized(pending) { pending.remove(promise) }) return
    guarded("settle a tools call") {
      val error = result.exceptionOrNull()
      if (error == null) {
        promise.resolve(result.getOrNull())
      } else {
        val failure = failure(error)
        promise.reject(failure.code, failure.error.message, failure.error)
      }
    }
  }

  private fun failure(error: Throwable): Failure =
    when (error) {
      is ToolRejected -> Failure(error.rejection.code, error)
      is RejectedExecutionException -> Failure(ToolRejection.CANCELLED.code, error)
      is IOException -> Failure(ToolRejection.IO.code, error)
      else -> Failure(ToolRejection.INTERNAL.code, error)
    }

  private fun ToolInstallEvent.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("toolId", toolId)
      putString("stage", stage.code)
      putDouble("receivedBytes", receivedBytes.toDouble())
      putDouble("totalBytes", totalBytes.toDouble())
      putInt("attempt", attempt)
      putString("failure", failure?.code)
      putString("detail", detail)
      putDouble("neededBytes", neededBytes.toDouble())
      putDouble("freeBytes", freeBytes.toDouble())
    }

  private fun ToolCatalogue.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("hostVersionName", index?.hostVersionName)
      putString("indexProblem", indexProblem?.code)
      putString("highWaterProblem", highWaterProblem?.code)
      putArray("tools", Arguments.createArray().apply { ids.forEach { pushMap(toolMap(it)) } })
    }

  private fun ToolCatalogue.toolMap(id: String): WritableMap {
    val entry = index?.entry(id)
    val local = installed.firstOrNull { it.id == id }
    return Arguments.createMap().apply {
      putString("toolId", id)
      putString("name", entry?.name)
      putString("icon", entry?.icon)
      putString("summary", entry?.summary)
      putString("version", entry?.version)
      putDouble("sizeBytes", (entry?.size ?: 0L).toDouble())
      putArray("capabilities", Arguments.createArray().apply { entry?.capabilities?.forEach(::pushString) })
      putString("installedVersion", local?.version)
      putString("installedManifestSha256", local?.manifestSha256)
      putDouble("installedBytes", (local?.bytes ?: 0L).toDouble())
      putString("installedProblem", local?.problem?.code)
      putString("highWaterVersion", highWater[id]?.version)
    }
  }

  private fun readPins(): String =
    try {
      reactApplicationContext.assets.open(rules.keyPinsFile).bufferedReader().use { it.readText() }
    } catch (error: FileNotFoundException) {
      reject(ToolRejection.PINS, "this build pins no tool keys")
    }

  private companion object {
    const val TAG = "KitbagTools"
    const val IO_THREAD_NAME = "kitbag-tools-io"
    const val INSTALL_THREAD_NAME = "kitbag-tools-install"
    const val STATE_FILE = ".installer.json"
    const val UNREADABLE_STATE = "tool downloads stay off until it is replaced"
    const val TORN_DOWN = "the tools module was torn down"
  }
}
