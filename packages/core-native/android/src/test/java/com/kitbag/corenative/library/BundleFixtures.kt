package com.kitbag.corenative.library

import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.json.JSONArray
import org.json.JSONObject

object BundleFixtures {
  const val FRAMES = 1000L

  fun manifestJson(stems: List<String>): JSONObject =
    JSONObject()
      .put("format", StemBundleManifest.FORMAT)
      .put("version", StemBundleManifest.SUPPORTED_VERSION)
      .put("job_id", "job123")
      .put("title", "Echo")
      .put("duration_sec", 311.0)
      .put("sample_rate", 44100)
      .put("channels", 2)
      .put(
        "stems",
        JSONArray().apply {
          stems.forEach { put(JSONObject().put("name", it).put("file", "stems/$it.flac").put("frames", FRAMES)) }
        },
      )

  fun manifest(stems: List<String>): String = manifestJson(stems).toString()

  fun stemBytes(name: String): ByteArray = "flac:$name".toByteArray()

  // Entries in the given order; a pair whose value is null is written as a directory.
  fun zip(vararg entries: Pair<String, ByteArray?>): ByteArray {
    val bytes = ByteArrayOutputStream()
    ZipOutputStream(bytes).use { zip ->
      for ((name, data) in entries) {
        zip.putNextEntry(ZipEntry(if (data == null) "$name/" else name))
        data?.let(zip::write)
        zip.closeEntry()
      }
    }
    return bytes.toByteArray()
  }

  fun bundle(stems: List<String>, vararg extra: Pair<String, ByteArray?>): ByteArray =
    zip(
      StemBundleManifest.FILE_NAME to manifest(stems).toByteArray(),
      *extra,
      *stems.map { "stems/$it.flac" to stemBytes(it) }.toTypedArray(),
    )

  fun source(bytes: ByteArray, size: Long = bytes.size.toLong()) = ZipBundleSource(size) { bytes.inputStream() }

  fun listTree(dir: File): List<String> =
    dir.walkTopDown().filter { it.isFile }.map { it.relativeTo(dir).invariantSeparatorsPath }.sorted().toList()
}
