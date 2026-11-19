package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import org.json.JSONArray
import org.json.JSONObject

data class AwayFiles(val volumeUuid: String, val paths: Set<String>, val mountedRoot: File?)

class AwayManifest(file: File, warn: (message: String, cause: Exception) -> Unit) {
  private val state = JsonStateFile(file, "songs absent from the root stay unknown", warn)

  fun load(): Map<String, Set<String>>? = state.read(emptyMap(), ::away)

  @Synchronized
  fun record(volumeUuid: String, relativePaths: Collection<String>) {
    val existing = load() ?: throw IOException("Refusing to overwrite an unreadable $FILE_NAME")
    state.write(json(existing + (volumeUuid to existing[volumeUuid].orEmpty() + relativePaths)))
  }

  private fun away(json: JSONObject): Map<String, Set<String>> {
    val volumes = json.getJSONArray(VOLUMES)
    return (0 until volumes.length()).map(volumes::getJSONObject).associate { volume ->
      val paths = volume.getJSONArray(PATHS)
      volume.getString(VOLUME_UUID) to (0 until paths.length()).mapTo(HashSet(), paths::getString)
    }
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
