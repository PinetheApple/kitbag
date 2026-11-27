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
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.util.concurrent.Executor

class DocumentPicker(
  private val context: ReactApplicationContext,
  private val io: Executor,
  private val rejectLogged: (Promise, String, String, Exception) -> Unit,
) : ActivityEventListener {

  private class Pending(val promise: Promise, val request: Int, val contents: String?, val source: File?)

  private var pending: Pending? = null

  private val settledCopy = SettledCopy(File(context.cacheDir, SettledCopy.WORK_DIR), SqliteRecovery)

  fun pickDocument(promise: Promise) {
    startPick(openDocumentIntent(PICKABLE_MIME_TYPES), REQUEST_PICK_DOCUMENT, promise)
  }

  fun pickDocuments(promise: Promise) {
    val intent = openDocumentIntent(PICKABLE_MIME_TYPES).putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
    startPick(intent, REQUEST_PICK_DOCUMENTS, promise)
  }

  fun pickBackup(promise: Promise) {
    startPick(openDocumentIntent(BACKUP_MIME_TYPES), REQUEST_PICK_BACKUP, promise)
  }

  fun saveBackup(fileName: String, contents: String, promise: Promise) {
    if (!BackupFiles.isSafeFileName(fileName)) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a backup file name: $fileName")
      return
    }
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = BackupFiles.JSON_MIME
      BackupSave.dialogExtras(fileName).forEach { (key, value) -> putExtra(key, value) }
    }
    startPick(intent, REQUEST_SAVE_BACKUP, promise, contents)
  }

  fun saveDatabaseCopy(databaseName: String, fileName: String, promise: Promise) {
    if (!BackupFiles.isSafeDatabaseName(databaseName) || !BackupFiles.isSafeCopyName(fileName)) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a database copy: $databaseName as $fileName")
      return
    }
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = BackupFiles.DATABASE_MIME
      BackupSave.dialogExtras(fileName).forEach { (key, value) -> putExtra(key, value) }
    }
    val source = context.getDatabasePath(databaseName)
    startPick(intent, REQUEST_SAVE_DATABASE, promise, source = source)
  }

  fun pickFolder(promise: Promise) {
    startPick(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQUEST_PICK_FOLDER, promise)
  }

  fun cancel() {
    synchronized(this) {
      pending?.promise?.reject(LibraryErrors.INVALIDATED, "The library module was torn down mid-pick")
      pending = null
    }
  }

  private fun openDocumentIntent(mimeTypes: Array<String>) =
    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
    }

  private fun startPick(
    intent: Intent,
    requestCode: Int,
    promise: Promise,
    contents: String? = null,
    source: File? = null,
  ) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject(LibraryErrors.NO_ACTIVITY, "No foreground activity to show the picker from")
      return
    }
    synchronized(this) {
      if (pending != null) {
        promise.reject(LibraryErrors.PICK_IN_PROGRESS, "A picker is already open")
        return
      }
      pending = Pending(promise, requestCode, contents, source)
    }
    activity.runOnUiThread {
      try {
        activity.startActivityForResult(intent, requestCode)
      } catch (e: ActivityNotFoundException) {
        takePending(requestCode)?.promise?.reject(LibraryErrors.NO_PICKER, "No app on this device can pick that", e)
      }
    }
  }

  @Synchronized
  private fun takePending(requestCode: Int): Pending? {
    if (pending?.request != requestCode) return null
    return pending.also { pending = null }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode !in PICK_REQUESTS) return
    val taken = takePending(requestCode) ?: return
    val promise = taken.promise
    val uri = data?.data
    if (requestCode == REQUEST_SAVE_BACKUP) {
      save(resultCode == Activity.RESULT_OK, uri, taken.contents, promise)
      return
    }
    if (requestCode == REQUEST_SAVE_DATABASE) {
      copy(resultCode == Activity.RESULT_OK, uri, taken.source, promise)
      return
    }
    if (requestCode == REQUEST_PICK_DOCUMENTS) {
      describeAll(if (resultCode == Activity.RESULT_OK) pickedUris(data) else emptyList(), promise)
      return
    }
    if (resultCode != Activity.RESULT_OK || uri == null) {
      promise.resolve(null)
      return
    }
    io.execute {
      try {
        promise.resolve(
          when (requestCode) {
            REQUEST_PICK_DOCUMENT -> describeDocument(uri)
            REQUEST_PICK_BACKUP -> readBackup(uri)
            else -> describeFolder(uri)
          },
        )
      } catch (e: Exception) {
        rejectLogged(promise, LibraryErrors.PICK_FAILED, "Could not read the picked item", e)
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun save(saved: Boolean, uri: Uri?, contents: String?, promise: Promise) {
    io.execute {
      try {
        promise.resolve(BackupSave.complete(saved, uri?.toString(), checkNotNull(contents), ::openForWrite, ::discard))
      } catch (e: Exception) {
        rejectLogged(promise, LibraryErrors.SAVE_FAILED, "Could not save the backup", e)
      }
    }
  }

  private fun copy(saved: Boolean, uri: Uri?, source: File?, promise: Promise) {
    io.execute {
      try {
        promise.resolve(BackupSave.copyFile(saved, uri?.toString(), checkNotNull(source), settledCopy, ::openForWrite, ::discard))
      } catch (e: Exception) {
        rejectLogged(promise, LibraryErrors.databaseCopyCode(e), "Could not save the database copy", e)
      }
    }
  }

  private fun describeAll(uris: List<Uri>, promise: Promise) {
    io.execute {
      try {
        promise.resolve(describeDocuments(uris))
      } catch (e: Exception) {
        rejectLogged(promise, LibraryErrors.PICK_FAILED, "Could not read the picked items", e)
      }
    }
  }

  // A multi-select result carries its items in clipData, and may leave data null.
  private fun pickedUris(data: Intent?): List<Uri> {
    val clip = data?.clipData ?: return listOfNotNull(data?.data)
    return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
  }

  private fun describeDocuments(uris: List<Uri>): WritableArray =
    Arguments.createArray().apply { uris.forEach { pushMap(describeDocument(it)) } }

  private fun openForWrite(uri: String, mode: String): OutputStream? =
    context.contentResolver.openOutputStream(Uri.parse(uri), mode)

  private fun discard(uri: String) {
    DocumentsContract.deleteDocument(context.contentResolver, Uri.parse(uri))
  }

  private fun describeDocument(uri: Uri): WritableMap =
    Arguments.createMap().apply {
      putString("uri", uri.toString())
      putString("name", displayName(uri) ?: uri.lastPathSegment.orEmpty())
      putString("mimeType", context.contentResolver.getType(uri).orEmpty())
    }

  private fun readBackup(uri: Uri): WritableMap {
    val bytes = context.contentResolver.openInputStream(uri)?.use { BackupFiles.readCapped(it) }
      ?: throw IOException("Could not open the picked file")
    return Arguments.createMap().apply {
      putString("name", displayName(uri) ?: uri.lastPathSegment.orEmpty())
      putDouble("bytes", bytes.size.toDouble())
      putString("contents", bytes.toString(Charsets.UTF_8))
    }
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

  internal companion object {
    private const val REQUEST_PICK_DOCUMENT = 0x4b42
    private const val REQUEST_PICK_FOLDER = 0x4b43
    private const val REQUEST_PICK_BACKUP = 0x4b44
    private const val REQUEST_SAVE_BACKUP = 0x4b46
    private const val REQUEST_SAVE_DATABASE = 0x4b47
    private const val REQUEST_PICK_DOCUMENTS = 0x4b48
    private val PICK_REQUESTS = setOf(
      REQUEST_PICK_DOCUMENT,
      REQUEST_PICK_DOCUMENTS,
      REQUEST_PICK_FOLDER,
      REQUEST_PICK_BACKUP,
      REQUEST_SAVE_BACKUP,
      REQUEST_SAVE_DATABASE,
    )

    private val ZIP_MIME_TYPES = listOf("application/zip", "application/x-zip-compressed")
    val PICKABLE_MIME_TYPES = (SupportedAudio.MIME_TYPES + ZIP_MIME_TYPES).toTypedArray()
    private val BACKUP_MIME_TYPES =
      arrayOf(BackupFiles.JSON_MIME, "text/plain", "application/octet-stream")
  }
}
