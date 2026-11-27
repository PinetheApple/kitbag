package com.kitbag.corenative.library

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicReference

class ShareIntake(
  private val io: Executor,
  private val describe: (Uri) -> WritableMap,
  private val emit: (WritableMap) -> Unit,
  private val warn: (String, Exception) -> Unit,
) : ActivityEventListener {

  fun takeLaunch(promise: Promise) {
    val uris = launch.getAndSet(null)?.let(::take).orEmpty()
    io.execute { promise.resolve(describeAll(uris)) }
  }

  override fun onNewIntent(intent: Intent) {
    val uris = take(intent)
    if (uris.isEmpty()) return
    io.execute { emit(Arguments.createMap().apply { putArray(ITEMS, describeAll(uris)) }) }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) = Unit

  private fun describeAll(uris: List<Uri>): WritableArray =
    Arguments.createArray().apply {
      uris.forEach { uri ->
        try {
          pushMap(describe(uri))
        } catch (e: Exception) {
          warn("Could not read a shared file", e)
        }
      }
    }

  companion object {
    private const val TAKEN = "com.kitbag.corenative.INTAKE_TAKEN"
    private const val ITEMS = "items"
    private val ACTIONS = setOf(Intent.ACTION_VIEW, Intent.ACTION_SEND, Intent.ACTION_SEND_MULTIPLE)
    private val FILE_SCHEMES = setOf(ContentResolver.SCHEME_CONTENT, ContentResolver.SCHEME_FILE)
    private val launch = AtomicReference<Intent?>(null)

    fun hold(intent: Intent) {
      launch.set(intent)
    }

    fun markTaken(intent: Intent) {
      intent.putExtra(TAKEN, true)
    }

    @Synchronized
    private fun take(intent: Intent): List<Uri> {
      if (intent.action !in ACTIONS || intent.getBooleanExtra(TAKEN, false)) return emptyList()
      markTaken(intent)
      if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return emptyList()
      return uris(intent).filter { it.scheme in FILE_SCHEMES }
    }

    private fun uris(intent: Intent): List<Uri> =
      when (intent.action) {
        Intent.ACTION_VIEW -> listOfNotNull(intent.data)
        Intent.ACTION_SEND -> listOfNotNull(stream(intent)).ifEmpty { clipUris(intent) }
        else -> streams(intent).ifEmpty { clipUris(intent) }
      }

    private fun stream(intent: Intent): Uri? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
      }

    private fun streams(intent: Intent): List<Uri> =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM).orEmpty()
      }

    private fun clipUris(intent: Intent): List<Uri> {
      val clip = intent.clipData ?: return emptyList()
      return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
    }
  }
}
