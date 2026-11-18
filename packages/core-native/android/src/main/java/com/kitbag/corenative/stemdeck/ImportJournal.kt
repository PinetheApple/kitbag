package com.kitbag.corenative.stemdeck

import java.io.File
import java.io.IOException
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

class ImportJournal(private val file: File) {
  fun save(snapshot: ImportSnapshot) = writeAtomically(file, json(snapshot).toString())

  fun load(): ImportSnapshot? {
    if (!file.isFile) return null
    return try {
      snapshot(JSONObject(file.readText()))
    } catch (e: JSONException) {
      null
    } catch (e: IllegalArgumentException) {
      null
    } catch (e: IOException) {
      null
    }
  }

  private fun json(snapshot: ImportSnapshot): JSONObject =
    JSONObject()
      .put(ORIGIN, snapshot.origin ?: JSONObject.NULL)
      .put(RUNNING, snapshot.running)
      .put(STOP_REASON, snapshot.stopReason ?: JSONObject.NULL)
      .put(ITEMS, JSONArray().apply { snapshot.items.forEach { put(json(it)) } })

  private fun json(item: ItemState): JSONObject =
    JSONObject()
      .put(JOB_ID, item.item.jobId)
      .put(TITLE, item.item.title)
      .put(STEMS, JSONArray(item.item.stems))
      .put(STATE, item.state)
      .put(FAILURE, item.failure ?: JSONObject.NULL)
      .put(BYTES_TOTAL, item.bytesTotal)
      .put(BYTES_FREE, item.bytesFree)

  private fun snapshot(json: JSONObject): ImportSnapshot {
    val items = json.getJSONArray(ITEMS)
    return ImportSnapshot(
      origin = optString(json, ORIGIN),
      running = json.getBoolean(RUNNING),
      stopReason = optString(json, STOP_REASON),
      items = (0 until items.length()).map { item(items.getJSONObject(it)) },
    )
  }

  private fun item(json: JSONObject): ItemState {
    val stems = json.getJSONArray(STEMS)
    return ItemState(
      item = ImportItem(json.getString(JOB_ID), json.getString(TITLE), (0 until stems.length()).map(stems::getString)),
      state = json.getString(STATE),
      failure = optString(json, FAILURE),
      bytesTotal = json.getLong(BYTES_TOTAL),
      bytesFree = json.getLong(BYTES_FREE),
    )
  }

  private fun optString(json: JSONObject, key: String): String? = if (json.isNull(key)) null else json.getString(key)

  companion object {
    const val FILE_NAME = "queue.json"
    private const val ORIGIN = "origin"
    private const val RUNNING = "running"
    private const val STOP_REASON = "stopReason"
    private const val ITEMS = "items"
    private const val JOB_ID = "jobId"
    private const val TITLE = "title"
    private const val STEMS = "stems"
    private const val STATE = "state"
    private const val FAILURE = "failure"
    private const val BYTES_TOTAL = "bytesTotal"
    private const val BYTES_FREE = "bytesFree"
  }
}
