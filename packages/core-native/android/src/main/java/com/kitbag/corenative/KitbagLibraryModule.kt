package com.kitbag.corenative

import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.kitbag.corenative.library.AnalysisEvents
import com.kitbag.corenative.library.AnalysisFailure
import com.kitbag.corenative.library.AnalysisResult
import com.kitbag.corenative.library.AnalysisStore
import com.kitbag.corenative.library.BackupShare
import com.kitbag.corenative.library.ClickSoundFiles
import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DocumentPicker
import com.kitbag.corenative.library.ExportFiles
import com.kitbag.corenative.library.FileShare
import com.kitbag.corenative.library.LibraryErrors
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.LibraryStorage
import com.kitbag.corenative.library.LibraryUsage
import com.kitbag.corenative.library.NativeClickSound
import com.kitbag.corenative.library.NativeWaveform
import com.kitbag.corenative.library.StemBundleBridge
import com.kitbag.corenative.library.StemBundleRefusedException
import com.kitbag.corenative.library.StorageUsage
import com.kitbag.corenative.library.SupportedAudio
import java.io.File
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

class KitbagLibraryModule(reactContext: ReactApplicationContext) :
  NativeKitbagLibrarySpec(reactContext) {

  private val results = LibraryStorage.analysisStore(reactContext)
  private val io: ExecutorService = Executors.newFixedThreadPool(IO_THREADS, named("kitbag-library-io"))
  private val nameLock = Any()
  private val bundles = StemBundleBridge(reactContext.contentResolver, ::libraryRoot)
  private val picker = DocumentPicker(reactContext, io, ::rejectLogged)
  private val files = FileShare(reactContext, io, ::rejectLogged)
  private val backups = BackupShare(reactContext, files)

  private val listener: (AnalysisResult) -> Unit = ::emitAnalysis

  init {
    reactContext.addActivityEventListener(picker)
    AnalysisEvents.listener.set(listener)
    io.execute { bundles.clearStaging() }
  }

  override fun invalidate() {
    AnalysisEvents.listener.compareAndSet(listener, null)
    reactApplicationContext.removeActivityEventListener(picker)
    io.shutdownNow()
    picker.cancel()
    super.invalidate()
  }

  override fun pickDocument(promise: Promise) = picker.pickDocument(promise)

  override fun pickFolder(promise: Promise) = picker.pickFolder(promise)

  override fun pickBackup(promise: Promise) = picker.pickBackup(promise)

  override fun shareBackup(fileName: String, contents: String, promise: Promise) =
    backups.share(fileName, contents, promise)

  override fun shareExport(path: String, promise: Promise) {
    val file = ExportFiles.resolve(reactApplicationContext.cacheDir, path)
    if (file == null) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not an exported file: $path")
      return
    }
    files.share(ExportFiles.shareSpec(), promise) { file }
  }

  private fun libraryRoot() = DataFolder.root(reactApplicationContext)

  override fun prepareClickSound(sourceUri: String, fileName: String, promise: Promise) {
    val target = ClickSoundFiles.resolve(reactApplicationContext.filesDir, fileName)
    if (target == null) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a click sound file name: $fileName")
      return
    }
    io.execute {
      var staging: File? = null
      try {
        staging = ClickSoundFiles.staging(reactApplicationContext.cacheDir)
        copyFrom(Uri.parse(sourceUri), staging)
        target.parentFile?.mkdirs()
        promise.resolve(NativeClickSound.prepare(staging, target))
      } catch (e: Exception) {
        rejectLogged(promise, E_IMPORT_FAILED, "Could not read the click sound", e)
      } finally {
        staging?.delete()
      }
    }
  }

  private fun copyFrom(source: Uri, file: File) {
    val input = reactApplicationContext.contentResolver.openInputStream(source)
      ?: throw IOException("Could not open $source")
    input.use { from -> file.outputStream().use { to -> from.copyTo(to) } }
  }

  override fun importAudio(uri: String, relativeDir: String, promise: Promise) {
    io.execute {
      var root: File? = null
      var dir: File? = null
      var reserved: File? = null
      try {
        val source = Uri.parse(uri)
        val displayName = picker.displayName(source)
        root = libraryRoot()
        dir = LibraryPaths.resolve(root, relativeDir, allowBase = true)
        reserved = reserveTarget(dir, source, displayName ?: source.lastPathSegment)
        copyInto(source, reserved)
        promise.resolve(importedAudio(root, reserved, displayName))
      } catch (e: Exception) {
        reserved?.delete()
        if (dir != null && dir != root?.canonicalFile) dir.delete()
        rejectLogged(promise, E_IMPORT_FAILED, "Import failed", e)
      }
    }
  }

  private fun reserveTarget(dir: File, source: Uri, displayName: String?): File {
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create $dir")
    val fallbackExtension = reactApplicationContext.contentResolver.getType(source)
      ?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
    val safeName = LibraryPaths.safeFileName(displayName, fallbackExtension)
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

  private fun importedAudio(root: File, file: File, displayName: String?): WritableMap {
    val metadata = readMetadata(file)
    return Arguments.createMap().apply {
      putString("relativePath", LibraryPaths.relativize(root, file))
      putString("title", metadata.title ?: LibraryPaths.displayTitle(displayName) ?: file.nameWithoutExtension)
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
      val root = libraryRoot()
      LibraryPaths.requireInsideLibrary(root, waveformRelativeDir, allowBase = true)
      LibraryPaths.relativize(root, LibraryPaths.resolve(root, relativePath))
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
      putDouble("durationSec", durationSec)
      analysisVersion?.let { putInt("analysisVersion", it) }
    }

  override fun deleteLibraryFile(relativePath: String, promise: Promise) {
    io.execute {
      try {
        val target = LibraryPaths.resolve(libraryRoot(), relativePath)
        if (target.isDirectory) throw IOException("$target is a directory")
        if (target.exists() && !target.delete()) throw IOException("Could not delete $target")
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_DELETE_FAILED, "Delete failed", e)
      }
    }
  }

  override fun deleteSongFolder(folderName: String, promise: Promise) {
    deleteFolder(promise) { LibraryPaths.songFolder(libraryRoot(), folderName) }
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
    deleteFolder(promise) { LibraryPaths.stemFolder(libraryRoot(), folderName) }
  }

  override fun readWaveform(relativePath: String, buckets: Double, promise: Promise) {
    io.execute {
      try {
        val envelope = NativeWaveform.envelope(LibraryPaths.resolve(libraryRoot(), relativePath), buckets.toInt())
          ?: throw IOException("Unreadable waveform sidecar")
        promise.resolve(Arguments.createArray().apply { envelope.forEach { pushDouble(it.toDouble()) } })
      } catch (e: Exception) {
        rejectLogged(promise, E_WAVEFORM_FAILED, "Could not read the waveform", e)
      }
    }
  }

  override fun storageReport(databaseName: String, promise: Promise) {
    io.execute {
      try {
        require(databaseName.isNotEmpty() && File(databaseName).name == databaseName) { "Not a database name" }
        val root = libraryRoot()
        val usage = LibraryUsage.measure(root, reactApplicationContext.getDatabasePath(databaseName))
        promise.resolve(usage.toMap(root.absolutePath))
      } catch (e: Exception) {
        rejectLogged(promise, E_STORAGE_FAILED, "Could not measure storage", e)
      }
    }
  }

  private fun StorageUsage.toMap(location: String): WritableMap =
    Arguments.createMap().apply {
      putMap(
        "libraryAudio",
        Arguments.createMap().apply {
          putInt("songs", libraryAudio.songs)
          putDouble("bytes", libraryAudio.bytes.toDouble())
        },
      )
      putMap(
        "stemSets",
        Arguments.createMap().apply {
          putInt("count", stemSets.count)
          putDouble("bytes", stemSets.bytes.toDouble())
        },
      )
      putMap("database", Arguments.createMap().apply { putDouble("bytes", databaseBytes.toDouble()) })
      putString("location", location)
    }

  override fun missingFiles(relativePaths: ReadableArray, promise: Promise) {
    io.execute {
      try {
        val paths = (0 until relativePaths.size()).asSequence().mapNotNull { relativePaths.getString(it) }
        promise.resolve(Arguments.createArray().apply { LibraryUsage.missing(libraryRoot(), paths).forEach(::pushString) })
      } catch (e: Exception) {
        rejectLogged(promise, E_STORAGE_FAILED, "Could not check library files", e)
      }
    }
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
      "supportedAudioFamilies" to SupportedAudio.FAMILY_NAMES,
      "supportedAudioExtensions" to SupportedAudio.EXTENSIONS,
      "supportedAudioMimeTypes" to SupportedAudio.MIME_TYPES,
      "unsupportedAudioExtensions" to SupportedAudio.UNSUPPORTED_EXTENSIONS,
      "exportMaxBaseNameBytes" to ExportFiles.MAX_BASE_NAME_BYTES,
    ) + StemBundleBridge.CONSTANTS + LibraryErrors.EXPORT_CONSTANTS

  companion object {
    private const val TAG = "KitbagLibrary"
    private const val IO_THREADS = 2
    private const val MILLIS_PER_SECOND = 1000.0

    private const val E_IMPORT_FAILED = "E_IMPORT_FAILED"
    private const val E_RESULTS_FAILED = "E_RESULTS_FAILED"
    private const val E_DELETE_FAILED = "E_DELETE_FAILED"
    private const val E_LIST_FAILED = "E_LIST_FAILED"
    private const val E_WAVEFORM_FAILED = "E_WAVEFORM_FAILED"
    private const val E_STORAGE_FAILED = "E_STORAGE_FAILED"

    private fun named(name: String) = ThreadFactory { Thread(it, name) }
  }
}
