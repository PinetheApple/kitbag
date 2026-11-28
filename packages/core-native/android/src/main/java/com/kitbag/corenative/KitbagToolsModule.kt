package com.kitbag.corenative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.kitbag.corenative.tools.BytecodeHandOff
import com.kitbag.corenative.tools.InstalledToolLoader
import com.kitbag.corenative.tools.InstalledTools
import com.kitbag.corenative.tools.ToolBundleRules
import com.kitbag.corenative.tools.ToolKeyRing
import com.kitbag.corenative.tools.ToolRejected
import com.kitbag.corenative.tools.ToolRejection
import com.kitbag.corenative.tools.VerifiedToolHandoff
import com.kitbag.corenative.tools.reject
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

class KitbagToolsModule(reactContext: ReactApplicationContext) : NativeKitbagToolsSpec(reactContext) {
  private class Failure(val code: String, val error: Throwable)

  private val io: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, IO_THREAD_NAME) }
  private val pending = mutableSetOf<Promise>()
  private val rules = ToolBundleRules.bundled
  private val keys by lazy { ToolKeyRing.parse(readPins(), emptySet(), rules) }
  private val loader by lazy {
    InstalledToolLoader(InstalledTools(reactContext.noBackupFilesDir, rules), rules, { keys }, NativeHandOff)
  }

  private object NativeHandOff : BytecodeHandOff {
    override fun handOff(toolId: String, bytecode: ByteArray, bytecodeVersion: Int) =
      VerifiedToolHandoff.handOff(toolId, bytecode, bytecodeVersion)

    override fun drop(toolId: String): Boolean = VerifiedToolHandoff.drop(toolId)
  }

  override fun invalidate() {
    io.shutdownNow()
    val unsettled = synchronized(pending) { pending.toList().also { pending.clear() } }
    for (promise in unsettled) promise.reject(ToolRejection.CANCELLED.code, TORN_DOWN)
    super.invalidate()
  }

  override fun verifyInstalled(toolId: String, promise: Promise) {
    synchronized(pending) { pending += promise }
    try {
      io.execute { settle(promise, load(toolId)) }
    } catch (error: RejectedExecutionException) {
      settle(promise, Failure(ToolRejection.CANCELLED.code, error))
    }
  }

  private fun load(toolId: String): Failure? =
    try {
      loader.load(toolId)
      null
    } catch (error: ToolRejected) {
      Failure(error.rejection.code, error)
    } catch (error: IOException) {
      Failure(ToolRejection.IO.code, error)
    } catch (error: Throwable) {
      Failure(ToolRejection.INTERNAL.code, error)
    }

  private fun settle(promise: Promise, failure: Failure?) {
    if (!synchronized(pending) { pending.remove(promise) }) return
    if (failure == null) promise.resolve(null) else promise.reject(failure.code, failure.error.message, failure.error)
  }

  private fun readPins(): String =
    try {
      reactApplicationContext.assets.open(rules.keyPinsFile).bufferedReader().use { it.readText() }
    } catch (error: FileNotFoundException) {
      reject(ToolRejection.PINS, "this build pins no tool keys")
    }

  private companion object {
    const val IO_THREAD_NAME = "kitbag-tools-io"
    const val TORN_DOWN = "the tools module was torn down"
  }
}
