package com.kitbag.corenative.library

import com.kitbag.corenative.stemdeck.writeAtomically
import java.io.File
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

data class AwayFiles(val volumeUuid: String, val paths: Set<String>, val mountedRoot: File?)

class AwayManifest(private val file: File, private val warn: (message: String, cause: Exception) -> Unit) {
  private val warned = AtomicBoolean(false)

  fun load(): Map<String, Set<String>>? {
    if (!file.isFile) return emptyMap()
    return try {
      val volumes = JSONObject(file.readText()).getJSONArray(VOLUMES)
      (0 until volumes.length()).map(volumes::getJSONObject).associate { volume ->
        val paths = volume.getJSONArray(PATHS)
        volume.getString(VOLUME_UUID) to (0 until paths.length()).mapTo(HashSet(), paths::getString)
      }
    } catch (e: JSONException) {
      unreadable(e)
    } catch (e: IOException) {
      unreadable(e)
    }
  }

  private fun unreadable(cause: Exception): Map<String, Set<String>>? {
    if (warned.compareAndSet(false, true)) warn("Unreadable $FILE_NAME; songs absent from the root stay unknown", cause)
    return null
  }

  @Synchronized
  fun record(volumeUuid: String, relativePaths: Collection<String>) {
    val existing = load() ?: throw IOException("Refusing to overwrite an unreadable $FILE_NAME")
    val merged = existing + (volumeUuid to existing[volumeUuid].orEmpty() + relativePaths)
    writeAtomically(file, json(merged).toString())
  }

  private fun json(away: Map<String, Set<String>>): JSONObject =
    JSONObject().put(
      VOLUMES,
      JSONArray().apply {
        away.forEach { (uuid, paths) -> put(JSONObject().put(VOLUME_UUID, uuid).put(PATHS, JSONArray(paths.sorted()))) }
      },
    )

  companion object {
    const val FILE_NAME = "data-folder-away.json"
    private const val VOLUMES = "volumes"
    private const val VOLUME_UUID = "volumeUuid"
    private const val PATHS = "paths"
  }
}
