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

class KitbagToolsModule(reactContext: ReactApplicationContext) : NativeKitbagToolsSpec(reactContext) {
  private val io: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, IO_THREAD_NAME) }
  private val rules = ToolBundleRules.bundled
  private val keys by lazy { ToolKeyRing.parse(readPins(), emptySet(), rules) }
  private val loader by lazy {
    InstalledToolLoader(
      InstalledTools(reactContext.noBackupFilesDir, rules),
      rules,
      { keys },
      BytecodeHandOff(VerifiedToolHandoff::handOff),
    )
  }

  override fun invalidate() {
    io.shutdownNow()
    super.invalidate()
  }

  override fun verifyInstalled(toolId: String, promise: Promise) {
    io.execute {
      try {
        loader.load(toolId)
        promise.resolve(null)
      } catch (error: ToolRejected) {
        promise.reject(error.rejection.code, error.message, error)
      } catch (error: IOException) {
        promise.reject(ToolRejection.IO.code, error.message, error)
      } catch (error: RuntimeException) {
        promise.reject(ToolRejection.HANDOFF.code, error.message, error)
      } catch (error: OutOfMemoryError) {
        promise.reject(ToolRejection.HANDOFF.code, error.message, error)
      }
    }
  }

  private fun readPins(): String =
    try {
      reactApplicationContext.assets.open(rules.keyPinsFile).bufferedReader().use { it.readText() }
    } catch (error: FileNotFoundException) {
      reject(ToolRejection.PINS, "this build pins no tool keys")
    }

  private companion object {
    const val IO_THREAD_NAME = "kitbag-tools-io"
  }
}
