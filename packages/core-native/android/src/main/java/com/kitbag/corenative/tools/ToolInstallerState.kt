package com.kitbag.corenative.tools

import com.kitbag.corenative.library.JsonStateFile
import org.json.JSONObject

internal class HighWaterMark(val version: String, val manifestSha256: String)

internal class ToolInstallerState(private val file: JsonStateFile, private val rules: ToolBundleRules) {
  private class Snapshot(val downloads: ToolDownloads, val highWater: Map<String, HighWaterMark>)

  @Synchronized
  fun downloads(): ToolDownloads = read()?.downloads ?: ToolDownloads.OFF

  @Synchronized
  fun setDownloads(downloads: ToolDownloads, installedFloor: () -> Map<String, HighWaterMark>) {
    val current = read()
    if (current != null) {
      write(Snapshot(downloads, current.highWater))
      return
    }
    val floor = installedFloor()
    file.setAside()
    write(Snapshot(downloads, floor))
  }

  @Synchronized
  fun highWater(id: String): HighWaterMark? = readable().highWater[id]

  @Synchronized
  fun highWaterMarks(): Map<String, HighWaterMark>? = read()?.highWater

  @Synchronized
  fun raiseHighWater(id: String, mark: HighWaterMark) {
    val current = readable()
    val held = current.highWater[id]
    if (held != null && ToolVersions.compare(mark.version, held.version) < 0) return
    write(Snapshot(current.downloads, current.highWater + (id to mark)))
  }

  private fun readable(): Snapshot =
    read() ?: reject(ToolRejection.IO, "the tool installer state is unreadable; refusing to guess the rollback marks")

  private fun read(): Snapshot? =
    file.read(Snapshot(ToolDownloads.UNASKED, emptyMap())) { json ->
      val downloads = ToolDownloads.valueOf(json.getString(DOWNLOADS))
      val marks = json.getJSONObject(HIGH_WATER)
      Snapshot(downloads, marks.keys().asSequence().associateWith { mark(it, marks.getJSONObject(it)) })
    }

  private fun mark(id: String, json: JSONObject): HighWaterMark {
    val version = json.getString(VERSION)
    val sha = json.getString(MANIFEST_SHA256)
    require(rules.id.matches(id) && rules.semver.matches(version) && rules.sha256.matches(sha)) { "malformed mark for $id" }
    return HighWaterMark(version, sha)
  }

  private fun write(snapshot: Snapshot) {
    val marks = JSONObject()
    for ((id, mark) in snapshot.highWater) {
      marks.put(id, JSONObject().put(VERSION, mark.version).put(MANIFEST_SHA256, mark.manifestSha256))
    }
    file.write(JSONObject().put(DOWNLOADS, snapshot.downloads.name).put(HIGH_WATER, marks))
  }

  private companion object {
    const val DOWNLOADS = "downloads"
    const val HIGH_WATER = "highWater"
    const val VERSION = "version"
    const val MANIFEST_SHA256 = "manifestSha256"
  }
}

internal object ToolVersions {
  private const val SEPARATOR = '.'

  fun compare(a: String, b: String): Int {
    val left = a.split(SEPARATOR)
    val right = b.split(SEPARATOR)
    for (i in left.indices) {
      val order = compareBy<String> { it.length }.thenBy { it }.compare(left[i], right[i])
      if (order != 0) return order
    }
    return 0
  }
}
