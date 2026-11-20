package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import org.json.JSONArray
import org.json.JSONObject

data class AwayFiles(val volumeUuid: String, val paths: Set<String>, val mountedRoot: File?)

data class AwaySongCounts(val songs: Int, val stemSongs: Int) {
  companion object {
    private const val FOLDER_DEPTH = 2

    fun of(paths: Collection<String>): AwaySongCounts {
      val folders = paths.map { it.split('/') }.filter { it.size > FOLDER_DEPTH }.mapTo(HashSet()) { it[0] to it[1] }
      return AwaySongCounts(
        songs = folders.count { it.first == LibraryPaths.SONGS_DIR_NAME },
        stemSongs = folders.count { it.first == LibraryPaths.STEMS_DIR_NAME },
      )
    }
  }
}

class AwayManifest(
  file: File,
  warn: (message: String, cause: Exception) -> Unit,
  unreadableMessage: String = "songs absent from the root stay unknown",
  private val setAsideUnreadable: Boolean = false,
) {
  private val state = JsonStateFile(file, unreadableMessage, warn)

  // Only a list whose loss costs space, never a file, may be set aside instead of trusted.
  fun load(): Map<String, Set<String>>? =
    state.read(emptyMap(), ::away) ?: emptyMap<String, Set<String>>().takeIf { setAsideUnreadable && state.setAside() }

  @Synchronized
  fun record(volumeUuid: String, relativePaths: Collection<String>) {
    val existing = load() ?: throw UnreadableStateException(state.name)
    state.write(json(existing + (volumeUuid to existing[volumeUuid].orEmpty() + relativePaths)))
  }

  fun remove(volumeUuid: String) = replace(volumeUuid, emptySet())

  @Synchronized
  fun removeAway(volumeUuid: String, relativePaths: Collection<String>) {
    val existing = load() ?: throw UnreadableStateException(state.name)
    replace(volumeUuid, existing[volumeUuid].orEmpty() - relativePaths.toSet())
  }

  @Synchronized
  fun replace(volumeUuid: String, relativePaths: Set<String>) {
    val existing = load() ?: throw UnreadableStateException(state.name)
    if (existing[volumeUuid].orEmpty() == relativePaths) return
    val rest = if (relativePaths.isEmpty()) existing - volumeUuid else existing + (volumeUuid to relativePaths)
    if (rest.isEmpty()) state.delete() else state.write(json(rest))
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
