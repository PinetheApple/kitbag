package com.kitbag.corenative

import android.net.Uri
import android.util.Base64
import android.util.Log
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.kitbag.corenative.library.AnalysisEvents
import com.kitbag.corenative.library.AudioHeader
import com.kitbag.corenative.library.AudioMetadata
import com.kitbag.corenative.library.AnalysisFailure
import com.kitbag.corenative.library.AnalysisResult
import com.kitbag.corenative.library.AnalysisStore
import com.kitbag.corenative.library.AnalysisTarget
import com.kitbag.corenative.library.BackupShare
import com.kitbag.corenative.library.ClickSoundFiles
import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DocumentPicker
import com.kitbag.corenative.library.ExportFiles
import com.kitbag.corenative.library.FileShare
import com.kitbag.corenative.library.LibraryDeletes
import com.kitbag.corenative.library.LibraryErrors
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.LibraryStorage
import com.kitbag.corenative.library.LibraryUsage
import com.kitbag.corenative.library.NativeClickSound
import com.kitbag.corenative.library.NativeWaveform
import com.kitbag.corenative.library.StemBundleBridge
import com.kitbag.corenative.library.StemBundleRefusedException
import com.kitbag.corenative.library.toMap
import com.kitbag.corenative.library.SupportedAudio
import com.kitbag.corenative.library.VolumeWatcher
import com.kitbag.corenative.library.move.DataFolderBridge
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
  private val moves = DataFolderBridge(
    reactContext,
    io,
    DataFolderBridge.Events(::emitOnMoveProgress, ::emitOnMoveFinished, ::emitOnDataFolderChanged),
    ::rejectLogged,
  )
  private val volumes = VolumeWatcher(reactContext, ::onVolumesChanged)

  private val listener: (AnalysisResult) -> Unit = ::emitAnalysis

  init {
    reactContext.addActivityEventListener(picker)
    AnalysisEvents.listener.set(listener)
    io.execute { bundles.clearStaging() }
    volumes.start()
    moves.start()
  }

  override fun invalidate() {
    AnalysisEvents.listener.compareAndSet(listener, null)
    volumes.stop()
    moves.stop()
    reactApplicationContext.removeActivityEventListener(picker)
    io.shutdownNow()
    picker.cancel()
    super.invalidate()
  }

  private fun onVolumesChanged() {
    emitOnDataFolderChanged()
    moves.volumesChanged()
  }

  override fun listVolumes(promise: Promise) = moves.listVolumes(promise)

  override fun startMove(volumeUuid: String?, promise: Promise) = moves.startMove(volumeUuid, promise)

  override fun cancelMove(promise: Promise) = moves.cancelMove(promise)

  override fun startCardReturn(volumeUuid: String, promise: Promise) = moves.startCardReturn(volumeUuid, promise)

  override fun resumeMove(promise: Promise) = moves.resumeMove(promise)

  override fun undoMove(promise: Promise) = moves.undoMove(promise)

  override fun moveStatus(promise: Promise) = moves.moveStatus(promise)

  override fun useInternalStorage(awayPaths: ReadableArray, promise: Promise) =
    moves.useInternalStorage(awayPaths, promise)

  override fun releaseOldCopies() = moves.releaseOldCopies()

  override fun pickDocument(promise: Promise) = picker.pickDocument(promise)

  override fun pickFolder(promise: Promise) = picker.pickFolder(promise)

  override fun pickBackup(promise: Promise) = picker.pickBackup(promise)

  override fun shareBackup(fileName: String, contents: String, promise: Promise) =
    backups.share(fileName, contents, promise)

  override fun saveBackup(fileName: String, contents: String, promise: Promise) =
    picker.saveBackup(fileName, contents, promise)

  override fun saveDatabaseCopy(databaseName: String, fileName: String, promise: Promise) =
    picker.saveDatabaseCopy(databaseName, fileName, promise)

  override fun shareExport(path: String, promise: Promise) {
    val file = ExportFiles.resolve(reactApplicationContext.cacheDir, path)
    if (file == null) {
      promise.reject(LibraryErrors.BAD_FILE_NAME, "Not an exported file: $path")
      return
    }
    files.share(ExportFiles.shareSpec(), promise) { file }
  }

  private fun dataFolder() = DataFolder.get(reactApplicationContext)

  private fun libraryRoot() = dataFolder().root()

  override fun prepareClickSound(sourceUri: String, fileName: String, promise: Promise) {
    val target = clickSoundFile(fileName, promise) ?: return
    io.execute {
      var staging: File? = null
      try {
        staging = ClickSoundFiles.staging(reactApplicationContext.cacheDir)
        copyFrom(Uri.parse(sourceUri), staging)
        target.parentFile?.mkdirs()
        promise.resolve(NativeClickSound.prepare(staging, target))
      } catch (e: IOException) {
        if (ClickSoundFiles.isNoSpace(e)) {
          promise.resolve(NativeClickSound.noSpace())
        } else {
          rejectLogged(promise, E_IMPORT_FAILED, "Could not read the click sound", e)
        }
      } catch (e: Exception) {
        rejectLogged(promise, E_IMPORT_FAILED, "Could not read the click sound", e)
      } finally {
        staging?.delete()
      }
    }
  }

  override fun readClickSound(fileName: String, promise: Promise) {
    val target = clickSoundFile(fileName, promise) ?: return
    io.execute {
      try {
        promise.resolve(Base64.encodeToString(target.readBytes(), Base64.NO_WRAP))
      } catch (e: Exception) {
        rejectLogged(promise, E_CLICK_SOUND_FAILED, "Could not read the click sound", e)
      }
    }
  }

  override fun writeClickSound(fileName: String, wavBase64: String, promise: Promise) {
    val target = clickSoundFile(fileName, promise) ?: return
    io.execute {
      try {
        ClickSoundFiles.write(target, Base64.decode(wavBase64, Base64.NO_WRAP))
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_CLICK_SOUND_FAILED, "Could not write the click sound", e)
      }
    }
  }

  override fun deleteClickSound(fileName: String, promise: Promise) {
    val target = clickSoundFile(fileName, promise) ?: return
    io.execute {
      try {
        ClickSoundFiles.delete(target)
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_DELETE_FAILED, "Could not delete the click sound", e)
      }
    }
  }

  override fun listClickSounds(promise: Promise) {
    io.execute {
      try {
        val names = Arguments.createArray()
        ClickSoundFiles.names(reactApplicationContext.filesDir).forEach { names.pushString(it) }
        promise.resolve(names)
      } catch (e: Exception) {
        rejectLogged(promise, E_LIST_FAILED, "Could not list click sounds", e)
      }
    }
  }

  override fun clearClickSoundPartials(promise: Promise) {
    io.execute {
      try {
        ClickSoundFiles.deletePartials(reactApplicationContext.filesDir)
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_DELETE_FAILED, "Could not clear partial click sounds", e)
      }
    }
  }

  private fun clickSoundFile(fileName: String, promise: Promise): File? {
    val target = ClickSoundFiles.resolve(reactApplicationContext.filesDir, fileName)
    if (target == null) promise.reject(LibraryErrors.BAD_FILE_NAME, "Not a click sound file name: $fileName")
    return target
  }

  private fun copyFrom(source: Uri, file: File) {
    val input = reactApplicationContext.contentResolver.openInputStream(source)
      ?: throw IOException("Could not open $source")
    input.use { from -> file.outputStream().use { to -> from.copyTo(to) } }
  }

  override fun sniffUnsupportedFormat(uri: String, promise: Promise) {
    io.execute {
      val format = AudioHeader.sniff {
        reactApplicationContext.contentResolver.openInputStream(Uri.parse(uri))
      }
      promise.resolve(format.orEmpty())
    }
  }

  override fun importAudio(uri: String, relativeDir: String, promise: Promise) {
    io.execute { dataFolder().importing { importAudioLocked(uri, relativeDir, promise) } }
  }

  private fun importAudioLocked(uri: String, relativeDir: String, promise: Promise) {
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
      promise.resolve(AudioMetadata.importedAudio(root, reserved, displayName))
    } catch (e: Exception) {
      reserved?.delete()
      if (dir != null && dir != root?.canonicalFile) dir.delete()
      rejectLogged(promise, E_IMPORT_FAILED, "Import failed", e)
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
      copyFrom(source, part)
      if (!part.renameTo(reserved)) throw IOException("Could not move the import into place")
    } finally {
      part.delete()
    }
  }

  override fun enqueueAnalysis(relativePath: String, waveformRelativeDir: String, replace: Boolean) {
    val canonical = when (val target = AnalysisTarget.of(::libraryRoot, relativePath, waveformRelativeDir)) {
      is AnalysisTarget.Ready -> target.relativePath
      AnalysisTarget.Refused -> {
        Log.w(TAG, "Analysis of $relativePath refused: the path escapes the library")
        io.execute { recordFailure(relativePath, AnalysisFailure.MISSING_FILE) }
        return
      }
      AnalysisTarget.Deferred -> return
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

  private fun emitAnalysis(result: AnalysisResult) = emitOnAnalysis(result.toMap())

  override fun deleteLibraryFile(relativePath: String, promise: Promise) {
    io.execute {
      try {
        LibraryDeletes.file(dataFolder(), relativePath)
        promise.resolve(null)
      } catch (e: Exception) {
        rejectLogged(promise, E_DELETE_FAILED, "Delete failed", e)
      }
    }
  }

  override fun deleteSongFolder(folderName: String, promise: Promise) {
    deleteFolder(promise) { LibraryDeletes.songFolder(dataFolder(), folderName) }
  }

  private fun deleteFolder(promise: Promise, delete: () -> Unit) {
    io.execute {
      try {
        delete()
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
        promise.resolve(dataFolder().importing { bundles.import(uri, isFolder) })
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
    deleteFolder(promise) { LibraryDeletes.stemFolder(dataFolder(), folderName) }
  }

  override fun readWaveform(relativePath: String, buckets: Double, promise: Promise) {
    io.execute {
      try {
        val envelope = NativeWaveform.envelope(dataFolder().readable(relativePath), buckets.toInt())
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

  override fun fileAvailability(relativePaths: ReadableArray, promise: Promise) {
    io.execute {
      try {
        val paths = (0 until relativePaths.size()).asSequence().mapNotNull { relativePaths.getString(it) }
        val root = DataFolder.get(reactApplicationContext).rootState()
        promise.resolve(LibraryUsage.availability(root, paths).toMap())
      } catch (e: Exception) {
        rejectLogged(promise, E_STORAGE_FAILED, "Could not check library files", e)
      }
    }
  }

  // Raw causes carry paths; JS gets the code and shows its own text.
  private fun rejectLogged(promise: Promise, code: String, message: String, cause: Exception) {
    Log.w(TAG, "$code: $message", cause)
    promise.reject(LibraryErrors.codeFor(cause, code), message)
  }

  override fun getTypedExportedConstants(): Map<String, Any> =
    mapOf(
      "songsDir" to LibraryPaths.SONGS_DIR_NAME,
      "stemsDir" to LibraryPaths.STEMS_DIR_NAME,
      "failureMissingFile" to AnalysisFailure.MISSING_FILE,
      "failureUnsupported" to AnalysisFailure.UNSUPPORTED,
      "failureInterrupted" to AnalysisFailure.INTERRUPTED,
      "failureInternal" to AnalysisFailure.INTERNAL,
      "failureUnavailable" to AnalysisFailure.UNAVAILABLE,
      "dataFolderUnavailable" to LibraryErrors.DATA_FOLDER_UNAVAILABLE,
      "supportedAudioFamilies" to SupportedAudio.FAMILY_NAMES,
      "supportedAudioExtensions" to SupportedAudio.EXTENSIONS,
      "supportedAudioMimeTypes" to SupportedAudio.MIME_TYPES,
      "unsupportedAudioExtensions" to SupportedAudio.UNSUPPORTED_EXTENSIONS,
      "exportMaxBaseNameBytes" to ExportFiles.MAX_BASE_NAME_BYTES,
      "databaseCopyUnsettled" to LibraryErrors.DATABASE_UNSETTLED,
    ) + StemBundleBridge.CONSTANTS + LibraryErrors.EXPORT_CONSTANTS + DataFolderBridge.CONSTANTS

  companion object {
    private const val TAG = "KitbagLibrary"
    private const val IO_THREADS = 2

    private const val E_IMPORT_FAILED = "E_IMPORT_FAILED"
    private const val E_RESULTS_FAILED = "E_RESULTS_FAILED"
    private const val E_DELETE_FAILED = "E_DELETE_FAILED"
    private const val E_CLICK_SOUND_FAILED = "E_CLICK_SOUND_FAILED"
    private const val E_LIST_FAILED = "E_LIST_FAILED"
    private const val E_WAVEFORM_FAILED = "E_WAVEFORM_FAILED"
    private const val E_STORAGE_FAILED = "E_STORAGE_FAILED"

    private fun named(name: String) = ThreadFactory { Thread(it, name) }
  }
}
