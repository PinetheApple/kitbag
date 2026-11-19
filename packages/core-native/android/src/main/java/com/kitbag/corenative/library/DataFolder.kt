package com.kitbag.corenative.library

import android.content.Context
import com.kitbag.corenative.stemdeck.writeAtomically
import java.io.File
import java.io.IOException
import java.util.concurrent.locks.ReentrantReadWriteLock
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
}

class DataFolderUnavailableException(val volumeUuid: String) :
  IOException("The data folder's volume is not mounted: $volumeUuid")

class DataFolder(filesDir: File, private val volumes: VolumeProvider) {
  val internalRoot = File(filesDir, DIR_NAME)
  val importLock = ReentrantReadWriteLock()
  private val stateFile = File(filesDir, STATE_FILE_NAME)

  fun location(): DataFolderLocation {
    if (!stateFile.isFile) return DataFolderLocation.Internal
    return try {
      val json = JSONObject(stateFile.readText())
      if (json.optString(KIND) == KIND_CARD) {
        DataFolderLocation.Card(json.getString(VOLUME_UUID))
      } else {
        DataFolderLocation.Internal
      }
    } catch (e: JSONException) {
      DataFolderLocation.Internal
    }
  }

  fun select(location: DataFolderLocation) = writeAtomically(stateFile, json(location).toString())

  fun root(): File =
    when (val location = location()) {
      DataFolderLocation.Internal -> internalRoot
      is DataFolderLocation.Card ->
        volumes.find(location.volumeUuid)?.takeIf { it.mounted }?.let { File(it.filesDir, DIR_NAME) }
          ?: throw DataFolderUnavailableException(location.volumeUuid)
    }

  fun resolve(relativePath: String): LibraryFile {
    LibraryPaths.requireRelative(relativePath)
    val root = try {
      root()
    } catch (e: DataFolderUnavailableException) {
      return LibraryFile.Unavailable(e.volumeUuid)
    }
    val file = LibraryPaths.resolve(root, relativePath)
    return if (file.exists()) LibraryFile.Present(file) else LibraryFile.Missing
  }

  private fun json(location: DataFolderLocation): JSONObject =
    when (location) {
      DataFolderLocation.Internal -> JSONObject().put(KIND, KIND_INTERNAL)
      is DataFolderLocation.Card -> JSONObject().put(KIND, KIND_CARD).put(VOLUME_UUID, location.volumeUuid)
    }

  companion object {
    const val DIR_NAME = "library"
    const val STATE_FILE_NAME = "data-folder.json"
    private const val KIND = "kind"
    private const val KIND_INTERNAL = "internal"
    private const val KIND_CARD = "card"
    private const val VOLUME_UUID = "volumeUuid"

    @Volatile private var instance: DataFolder? = null

    fun get(context: Context): DataFolder =
      instance ?: synchronized(this) {
        instance ?: context.applicationContext.let { DataFolder(it.filesDir, AndroidVolumes(it)) }
          .also { instance = it }
      }

    fun root(context: Context): File = get(context).root()
  }
}
