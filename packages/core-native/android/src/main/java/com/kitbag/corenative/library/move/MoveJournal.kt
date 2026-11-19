package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.JsonStateFile
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

enum class MovePhase { PREFLIGHT, COPYING, VERIFYING, CATCH_UP, SWITCHED, CLEANING, DONE }

data class MoveEntry(
  val path: String,
  val size: Long,
  val modified: Long,
  val sha256: String? = null,
  val verified: Boolean = false,
) {
  val copied: Boolean get() = sha256 != null

  fun isCopyOf(source: MoveSourceFile) = verified && source.size == size && source.modified == modified
}

data class MoveState(
  val source: DataFolderLocation,
  val target: DataFolderLocation,
  val phase: MovePhase,
  val files: List<MoveEntry>,
  val failure: MoveFailure? = null,
) {
  val totalBytes: Long get() = files.sumOf { it.size }
}

class MoveJournal(file: File, warn: (message: String, cause: Exception) -> Unit) {
  private val stored = JsonStateFile(file, "no move in progress", warn)

  fun save(state: MoveState) = stored.write(json(state))

  // A journal that cannot be read means no move: nothing may be deleted on its word.
  fun load(): MoveState? = stored.read(null, ::state)

  fun clear() = stored.delete()

  private fun json(state: MoveState): JSONObject =
    JSONObject()
      .put(VERSION, FORMAT_VERSION)
      .put(PHASE, state.phase.name)
      .put(SOURCE, DataFolder.toJson(state.source))
      .put(TARGET, DataFolder.toJson(state.target))
      .put(FAILURE, state.failure?.name ?: JSONObject.NULL)
      .put(FILES, JSONArray().apply { state.files.forEach { put(json(it)) } })

  private fun json(entry: MoveEntry): JSONObject =
    JSONObject()
      .put(PATH, entry.path)
      .put(SIZE, entry.size)
      .put(MODIFIED, entry.modified)
      .put(SHA256, entry.sha256 ?: JSONObject.NULL)
      .put(VERIFIED, entry.verified)

  private fun state(json: JSONObject): MoveState {
    require(json.getInt(VERSION) == FORMAT_VERSION) { "Unknown $FILE_NAME version" }
    val files = json.getJSONArray(FILES)
    return MoveState(
      source = DataFolder.locationOf(json.getJSONObject(SOURCE)),
      target = DataFolder.locationOf(json.getJSONObject(TARGET)),
      phase = MovePhase.valueOf(json.getString(PHASE)),
      files = (0 until files.length()).map { entry(files.getJSONObject(it)) },
      failure = if (json.isNull(FAILURE)) null else MoveFailure.valueOf(json.getString(FAILURE)),
    )
  }

  private fun entry(json: JSONObject): MoveEntry =
    MoveEntry(
      path = json.getString(PATH),
      size = json.getLong(SIZE),
      modified = json.getLong(MODIFIED),
      sha256 = if (json.isNull(SHA256)) null else json.getString(SHA256),
      verified = json.getBoolean(VERIFIED),
    )

  companion object {
    const val FILE_NAME = "data-folder-move.json"
    private const val FORMAT_VERSION = 1
    private const val VERSION = "version"
    private const val PHASE = "phase"
    private const val SOURCE = "source"
    private const val TARGET = "target"
    private const val FAILURE = "failure"
    private const val FILES = "files"
    private const val PATH = "path"
    private const val SIZE = "size"
    private const val MODIFIED = "modified"
    private const val SHA256 = "sha256"
    private const val VERIFIED = "verified"
  }
}
