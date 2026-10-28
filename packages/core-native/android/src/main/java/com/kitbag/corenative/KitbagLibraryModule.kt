package com.kitbag.corenative

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.kitbag.corenative.library.AnalysisEvents
import com.kitbag.corenative.library.AnalysisFailure
import com.kitbag.corenative.library.AnalysisResult
import com.kitbag.corenative.library.AnalysisStore
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.LibraryStorage
import com.kitbag.corenative.library.StemBundleBridge
import com.kitbag.corenative.library.StemBundleRefusedException
import java.io.File
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

class KitbagLibraryModule(reactContext: ReactApplicationContext) :
  NativeKitbagLibrarySpec(reactContext), ActivityEventListener {

  private val base = LibraryStorage.base(reactContext)
  private val results = LibraryStorage.analysisStore(reactContext)
  private val io: ExecutorService = Executors.newFixedThreadPool(IO_THREADS, named("kitbag-library-io"))
  private val nameLock = Any()
  private val bundles = StemBundleBridge(reactContext.contentResolver, base)

  private var pendingPick: Promise? = null
  private var pendingRequest = 0

  private val listener: (AnalysisResult) -> Unit = ::emitAnalysis

  init {
    reactContext.addActivityEventListener(this)
    AnalysisEvents.listener.set(listener)
    io.execute { bundles.clearStaging() }
  }

  override fun invalidate() {
    AnalysisEvents.listener.compareAndSet(listener, null)
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdownNow()
    synchronized(this) {
      pendingPick?.reject(E_INVALIDATED, "The library module was torn down mid-pick")
      pendingPick = null
    }
    super.invalidate()
  }

  override fun pickDocument(promise: Promise) {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(Intent.EXTRA_MIME_TYPES, PICKABLE_MIME_TYPES)
    }
    startPick(intent, REQUEST_PICK_DOCUMENT, promise)
  }

  override fun pickFolder(promise: Promise) {
    startPick(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQUEST_PICK_FOLDER, promise)
  }

  private fun startPick(intent: Intent, requestCode: Int, promise: Promise) {
    val activity = currentActivity
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
      putString("mimeType", reactApplicationContext.contentResolver.getType(uri).orEmpty())
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

  private fun displayName(uri: Uri): String? =
    reactApplicationContext.contentResolver
      .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
      ?.use { cursor ->
        if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
      }

  override fun importAudio(uri: String, relativeDir: String, promise: Promise) {
    io.execute {
      var dir: File? = null
      var reserved: File? = null
      try {
        val source = Uri.parse(uri)
        dir = LibraryPaths.resolve(base, relativeDir, allowBase = true)
        reserved = reserveTarget(dir, source)
        copyInto(source, reserved)
        promise.resolve(importedAudio(reserved))
      } catch (e: Exception) {
        reserved?.delete()
        if (dir != null && dir != base.canonicalFile) dir.delete()
        rejectLogged(promise, E_IMPORT_FAILED, "Import failed", e)
      }
    }
  }

  private fun reserveTarget(dir: File, source: Uri): File {
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create $dir")
    val fallbackExtension = reactApplicationContext.contentResolver.getType(source)
      ?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
    val safeName = LibraryPaths.safeFileName(displayName(source) ?: source.lastPathSegment, fallbackExtension)
    return synchronized(nameLock) {
      File(dir, LibraryPaths.uniqueFileName(safeName, dir.list()?.toList().orEmpty()))
        .also { it.createNewFile() }
    }
  }

  private fun copyInto(source: Uri, reserved: File) {
    val part = File(reserved.parentFile, ".${reserved.name}.part")
    try {
      val input = reactApplicationContext.contentResolver.openInputStream(source)
        ?: throw IOException("Could not open $source")
      input.use { from -> part.outputStream().use { to -> from.copyTo(to) } }
      if (!part.renameTo(reserved)) throw IOException("Could not move the import into place")
    } finally {
      part.delete()
    }
  }

  private fun importedAudio(file: File): WritableMap {
    val metadata = readMetadata(file)
    return Arguments.createMap().apply {
      putString("relativePath", LibraryPaths.relativize(base, file))
      putString("title", metadata.title ?: file.nameWithoutExtension)
      putString("artist", metadata.artist.orEmpty())
      putDouble("durationSec", metadata.durationSec)
    }
  }

  private class AudioMetadata(val title: String?, val artist: String?, val durationSec: Double)

  private fun readMetadata(file: File): AudioMetadata {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(file.path)
      AudioMetadata(
        title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() },
        artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() },
        durationSec = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
          ?.toLongOrNull()?.let { it / MILLIS_PER_SECOND } ?: 0.0,
      )
    } catch (e: RuntimeException) {
      AudioMetadata(null, null, 0.0)
    } finally {
      retriever.release()
    }
  }

  override fun enqueueAnalysis(relativePath: String, waveformRelativeDir: String, replace: Boolean) {
    val canonical = try {
      LibraryPaths.requireInsideLibrary(base, waveformRelativeDir, allowBase = true)
      LibraryPaths.relativize(base, LibraryPaths.resolve(base, relativePath))
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "Analysis of $relativePath refused", e)
      io.execute { recordFailure(relativePath, AnalysisFailure.MISSING_FILE) }
      return
    }
    val request = OneTimeWorkRequestBuilder<AnalysisWorker>()
      .setInputData(
        workDataOf(
          AnalysisWorker.KEY_RELATIVE_PATH to canonical,
          AnalysisWorker.KEY_WAVEFORM_DIR to waveformRelativeDir,
        ),
      )
      .build()
    WorkManager.getInstance(reactApplicationContext).enqueueUniqueWork(
      AnalysisStore.uniqueWorkName(canonical),
      if (replace) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
      request,
    )
  }

  private fun recordFailure(relativePath: String, error: String) {
    val result = AnalysisResult.failed(relativePath, error)
    results.save(result)
    emitAnalysis(result)
  }

  override fun cancelAnalysis(relativePath: String) {
    WorkManager.getInstance(reactApplicationContext)
      .cancelUniqueWork(AnalysisStore.uniqueWorkName(relativePath))
    io.execute { results.remove(relativePath) }
  }

  override fun pendingAnalyses(promise: Promise) {
    io.execute {
      try {
        promise.resolve(Arguments.createArray().apply { results.pending().forEach { pushMap(it.toMap()) } })
      } catch (e: Exception) {
        rejectLogged(promise, E_RESULTS_FAILED, "Could not read analysis results", e)
      }
    }
  }

  override fun acknowledgeAnalysis(relativePath: String) {
    io.execute { results.remove(relativePath) }
  }

  private fun emitAnalysis(result: AnalysisResult) {
    emitOnAnalysis(result.toMap())
  }

  private fun AnalysisResult.toMap(): WritableMap =
    Arguments.createMap().apply {
      putString("relativePath", relativePath)
      putBoolean("ok", ok)
      putString("error", error)
      putDouble("bpm", bpm.toDouble())
      putArray("beats", Arguments.createArray().apply { beats.forEach { pushDouble(it.toDouble()) } })
      putArray("downbeats", Arguments.createArray().apply { downbeats.forEach { pushInt(it) } })
      putString("waveformRelativePath", waveformRelativePath)
    }

  override fun deleteLibraryFile(relativePath: String, promise: Promise) {
    io.execute {
      try {
        val target = LibraryPaths.resolve(base, relativePath)
        if (target.isDirectory) throw IOException("$target is a directory")
        if (target.exists() && !target.delete()) throw IOException("Could not delete $target")
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_DELETE_FAILED, "Delete failed", e)
      }
    }
  }

  override fun deleteSongFolder(folderName: String, promise: Promise) {
    deleteFolder(promise) { LibraryPaths.songFolder(base, folderName) }
  }

  private fun deleteFolder(promise: Promise, resolveFolder: () -> File) {
    io.execute {
      try {
        val folder = resolveFolder()
        if (folder.exists() && !folder.deleteRecursively()) throw IOException("Could not delete $folder")
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_DELETE_FAILED, "Delete failed", e)
      }
    }
  }

  override fun checkStemBundle(uri: String, isFolder: Boolean, promise: Promise) {
    io.execute {
      try {
        promise.resolve(bundles.check(uri, isFolder))
      } catch (e: Exception) {
        rejectLogged(promise, E_IMPORT_FAILED, "Could not read the bundle", e)
      }
    }
  }

  override fun importStemBundle(uri: String, isFolder: Boolean, promise: Promise) {
    io.execute {
      try {
        promise.resolve(bundles.import(uri, isFolder))
      } catch (e: StemBundleRefusedException) {
        rejectLogged(promise, e.refusal, "The bundle was refused", e)
      } catch (e: Exception) {
        rejectLogged(promise, E_IMPORT_FAILED, "Import failed", e)
      }
    }
  }

  override fun listStemFolders(promise: Promise) {
    io.execute {
      try {
        promise.resolve(bundles.stemFolderNames())
      } catch (e: Exception) {
        rejectLogged(promise, E_LIST_FAILED, "Could not list stem folders", e)
      }
    }
  }

  override fun deleteStemFolder(folderName: String, promise: Promise) {
    deleteFolder(promise) { LibraryPaths.stemFolder(base, folderName) }
  }

  // Raw causes carry paths; JS gets the code and shows its own text.
  private fun rejectLogged(promise: Promise, code: String, message: String, cause: Exception) {
    Log.w(TAG, "$code: $message", cause)
    promise.reject(code, message)
  }

  override fun getTypedExportedConstants(): Map<String, Any> =
    mapOf(
      "songsDir" to LibraryPaths.SONGS_DIR_NAME,
      "stemsDir" to LibraryPaths.STEMS_DIR_NAME,
      "failureMissingFile" to AnalysisFailure.MISSING_FILE,
      "failureUnsupported" to AnalysisFailure.UNSUPPORTED,
      "failureInterrupted" to AnalysisFailure.INTERRUPTED,
      "failureInternal" to AnalysisFailure.INTERNAL,
    ) + StemBundleBridge.CONSTANTS

  companion object {
    private const val TAG = "KitbagLibrary"
    private const val IO_THREADS = 2
    private const val MILLIS_PER_SECOND = 1000.0

    private const val REQUEST_PICK_DOCUMENT = 0x4b42
    private const val REQUEST_PICK_FOLDER = 0x4b43

    private val PICKABLE_MIME_TYPES =
      arrayOf("audio/*", "application/zip", "application/x-zip-compressed")

    private const val E_NO_ACTIVITY = "E_NO_ACTIVITY"
    private const val E_PICK_IN_PROGRESS = "E_PICK_IN_PROGRESS"
    private const val E_NO_PICKER = "E_NO_PICKER"
    private const val E_PICK_FAILED = "E_PICK_FAILED"
    private const val E_INVALIDATED = "E_INVALIDATED"
    private const val E_IMPORT_FAILED = "E_IMPORT_FAILED"
    private const val E_RESULTS_FAILED = "E_RESULTS_FAILED"
    private const val E_DELETE_FAILED = "E_DELETE_FAILED"
    private const val E_LIST_FAILED = "E_LIST_FAILED"

    private fun named(name: String) = ThreadFactory { Thread(it, name) }
  }
}
