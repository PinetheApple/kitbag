package com.kitbag.corenative.library

import com.kitbag.corenative.stemdeck.writeAtomically
import java.io.File
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONException
import org.json.JSONObject

class JsonStateFile(
  private val file: File,
  private val unreadableMessage: String,
  private val warn: (message: String, cause: Exception) -> Unit,
) {
  private val warned = AtomicBoolean(false)

  val name: String get() = file.name

  // Null means unreadable, which callers must never treat as "nothing there".
  fun <T> read(absent: T, parse: (JSONObject) -> T): T? {
    if (!file.isFile) return absent
    return try {
      parse(JSONObject(file.readText()))
    } catch (e: JSONException) {
      unreadable(e)
    } catch (e: IllegalArgumentException) {
      unreadable(e)
    } catch (e: IOException) {
      unreadable(e)
    }
  }

  private fun <T> unreadable(cause: Exception): T? {
    if (warned.compareAndSet(false, true)) warn("Unreadable ${file.name}; $unreadableMessage", cause)
    return null
  }

  fun write(json: JSONObject) = writeAtomically(file, json.toString(), durable = true)

  fun delete() {
    if (file.exists() && !file.delete()) throw IOException("Could not delete ${file.name}")
  }
}
