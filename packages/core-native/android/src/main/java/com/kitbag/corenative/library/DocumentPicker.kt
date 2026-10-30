package com.kitbag.corenative.library

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.Executor

class DocumentPicker(
  private val context: ReactApplicationContext,
  private val io: Executor,
  private val rejectLogged: (Promise, String, String, Exception) -> Unit,
) : ActivityEventListener {

  private var pendingPick: Promise? = null
  private var pendingRequest = 0

  fun pickDocument(promise: Promise) {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(Intent.EXTRA_MIME_TYPES, PICKABLE_MIME_TYPES)
    }
    startPick(intent, REQUEST_PICK_DOCUMENT, promise)
  }

  fun pickFolder(promise: Promise) {
    startPick(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQUEST_PICK_FOLDER, promise)
  }

  fun cancel() {
    synchronized(this) {
      pendingPick?.reject(E_INVALIDATED, "The library module was torn down mid-pick")
      pendingPick = null
    }
  }

  private fun startPick(intent: Intent, requestCode: Int, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject(E_NO_ACTIVITY, "No foreground activity to show the picker from")
      return
    }
    synchronized(this) {
      if (pendingPick != null) {
        promise.reject(E_PICK_IN_PROGRESS, "A picker is already open")
        return
      }
      pendingPick = promise
      pendingRequest = requestCode
    }
    activity.runOnUiThread {
      try {
        activity.startActivityForResult(intent, requestCode)
      } catch (e: ActivityNotFoundException) {
        takePendingPick(requestCode)?.reject(E_NO_PICKER, "No app on this device can pick that", e)
      }
    }
  }

  @Synchronized
  private fun takePendingPick(requestCode: Int): Promise? {
    if (pendingRequest != requestCode) return null
    return pendingPick.also {
      pendingPick = null
      pendingRequest = 0
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_PICK_DOCUMENT && requestCode != REQUEST_PICK_FOLDER) return
    val promise = takePendingPick(requestCode) ?: return
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      promise.resolve(null)
      return
    }
    io.execute {
      try {
        promise.resolve(
          if (requestCode == REQUEST_PICK_DOCUMENT) describeDocument(uri) else describeFolder(uri),
        )
      } catch (e: Exception) {
        rejectLogged(promise, E_PICK_FAILED, "Could not read the picked item", e)
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun describeDocument(uri: Uri): WritableMap =
    Arguments.createMap().apply {
      putString("uri", uri.toString())
      putString("name", displayName(uri) ?: uri.lastPathSegment.orEmpty())
      putString("mimeType", context.contentResolver.getType(uri).orEmpty())
    }

  // The grant is not persisted; it lasts while the process does, replace sheet included.
  private fun describeFolder(treeUri: Uri): WritableMap {
    val documentUri = DocumentsContract.buildDocumentUriUsingTree(
      treeUri,
      DocumentsContract.getTreeDocumentId(treeUri),
    )
    return Arguments.createMap().apply {
      putString("uri", treeUri.toString())
      putString("name", displayName(documentUri) ?: treeUri.lastPathSegment.orEmpty())
    }
  }

  fun displayName(uri: Uri): String? =
    context.contentResolver
      .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
      ?.use { cursor ->
        if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
      }

  private companion object {
    const val REQUEST_PICK_DOCUMENT = 0x4b42
    const val REQUEST_PICK_FOLDER = 0x4b43

    val PICKABLE_MIME_TYPES =
      arrayOf("audio/*", "application/zip", "application/x-zip-compressed")

    const val E_NO_ACTIVITY = "E_NO_ACTIVITY"
    const val E_PICK_IN_PROGRESS = "E_PICK_IN_PROGRESS"
    const val E_NO_PICKER = "E_NO_PICKER"
    const val E_PICK_FAILED = "E_PICK_FAILED"
    const val E_INVALIDATED = "E_INVALIDATED"
  }
}
