package com.kitbag.corenative.library

import android.content.Context
import android.util.Log
import java.io.File
import java.io.IOException
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write
import org.json.JSONException
import org.json.JSONObject

sealed interface DataFolderLocation {
  object Internal : DataFolderLocation

  data class Card(val volumeUuid: String) : DataFolderLocation
}

sealed interface LibraryFile {
  data class Present(val file: File) : LibraryFile

  object Missing : LibraryFile

  data class Unavailable(val volumeUuid: String) : LibraryFile

  object Unknown : LibraryFile
}

sealed interface RootState {
  fun resolve(relativePath: String): LibraryFile

  data class Mounted(
    val root: File,
    // False when the state file or the away list is unreadable: an absent song may sit on a card, not be gone.
    val known: Boolean,
    val away: List<AwayFiles> = emptyList(),
  ) : RootState {
    override fun resolve(relativePath: String): LibraryFile {
      val file = LibraryPaths.resolve(root, relativePath)
      if (file.exists()) return LibraryFile.Present(file)
      val awayFile = away.firstOrNull { relativePath in it.paths }?.let { awayFile(it, relativePath) }
      return awayFile ?: if (known) LibraryFile.Missing else LibraryFile.Unknown
    }

    private fun awayFile(away: AwayFiles, relativePath: String): LibraryFile? {
      val cardRoot = away.mountedRoot ?: return LibraryFile.Unavailable(away.volumeUuid)
      return LibraryPaths.resolve(cardRoot, relativePath).takeIf { it.exists() }?.let(LibraryFile::Present)
    }
  }

  data class Unmounted(val volumeUuid: String) : RootState {
    override fun resolve(relativePath: String): LibraryFile {
      LibraryPaths.requireRelative(relativePath)
      return LibraryFile.Unavailable(volumeUuid)
    }
  }
}

class DataFolderUnavailableException(val volumeUuid: String) :
  IOException("The data folder's volume is not mounted: $volumeUuid")

class DataFolder(
  filesDir: File,
  private val volumes: VolumeProvider,
  private val warn: (message: String, cause: Exception) -> Unit,
) {
  val internalRoot = File(filesDir, DIR_NAME)
  private val stateFile = JsonStateFile(File(filesDir, STATE_FILE_NAME), "using internal storage", warn)
  private val awayManifest = AwayManifest(File(filesDir, AwayManifest.FILE_NAME), warn)

  internal val importLock = ReentrantReadWriteLock()

  fun <T> importing(block: () -> T): T = importLock.read(block)

  fun <T> switching(block: () -> T): T = importLock.write(block)

  fun location(): DataFolderLocation = storedLocation() ?: DataFolderLocation.Internal

  fun storedLocation(): DataFolderLocation? = stateFile.read(DataFolderLocation.Internal, ::locationOf)

  fun select(location: DataFolderLocation) = stateFile.write(toJson(location))

  fun rootState(): RootState {
    val location = storedLocation()
    val away = awayManifest.load()
    val state = rootStateAt(location ?: DataFolderLocation.Internal)
    return if (state is RootState.Mounted) {
      state.copy(known = location != null && away != null, away = awayFiles(away.orEmpty()))
    } else {
      state
    }
  }

  fun rootStateAt(location: DataFolderLocation): RootState =
    when (location) {
      DataFolderLocation.Internal -> RootState.Mounted(internalRoot, known = true)
      is DataFolderLocation.Card -> cardRoot(location.volumeUuid)?.let { RootState.Mounted(it, known = true) }
        ?: RootState.Unmounted(location.volumeUuid)
    }

  fun volume(volumeUuid: String): PortableVolume? = volumes.find(volumeUuid)

  fun portableVolumes(): List<PortableVolume> = volumes.portable()

  private fun cardRoot(volumeUuid: String): File? =
    volumes.find(volumeUuid)?.takeIf { it.mounted }?.let { File(it.filesDir, DIR_NAME) }

  private fun awayFiles(away: Map<String, Set<String>>): List<AwayFiles> =
    away.map { (uuid, paths) -> AwayFiles(uuid, paths, cardRoot(uuid)) }

  fun leaveAway(volumeUuid: String, relativePaths: Collection<String>) {
    relativePaths.forEach(LibraryPaths::requireRelative)
    awayManifest.record(volumeUuid, relativePaths)
  }

  fun root(): File =
    when (val state = rootStateAt(location())) {
      is RootState.Mounted -> state.root
      is RootState.Unmounted -> throw DataFolderUnavailableException(state.volumeUuid)
    }

  fun resolve(relativePath: String): LibraryFile = rootState().resolve(relativePath)

  companion object {
    const val DIR_NAME = "library"
    const val STATE_FILE_NAME = "data-folder.json"
    private const val KIND = "kind"
    private const val KIND_INTERNAL = "internal"
    private const val KIND_CARD = "card"
    private const val VOLUME_UUID = "volumeUuid"
    private const val TAG = "KitbagDataFolder"

    @Volatile private var instance: DataFolder? = null

    fun get(context: Context): DataFolder =
      instance ?: synchronized(this) {
        instance ?: context.applicationContext
          .let { DataFolder(it.filesDir, AndroidVolumes(it)) { message, cause -> Log.w(TAG, message, cause) } }
          .also { instance = it }
      }

    fun root(context: Context): File = get(context).root()

    fun toJson(location: DataFolderLocation): JSONObject =
      when (location) {
        DataFolderLocation.Internal -> JSONObject().put(KIND, KIND_INTERNAL)
        is DataFolderLocation.Card -> JSONObject().put(KIND, KIND_CARD).put(VOLUME_UUID, location.volumeUuid)
      }

    fun locationOf(json: JSONObject): DataFolderLocation =
      when (val kind = json.getString(KIND)) {
        KIND_INTERNAL -> DataFolderLocation.Internal
        KIND_CARD -> DataFolderLocation.Card(json.getString(VOLUME_UUID))
        else -> throw JSONException("Unknown data folder kind: $kind")
      }
  }
}
