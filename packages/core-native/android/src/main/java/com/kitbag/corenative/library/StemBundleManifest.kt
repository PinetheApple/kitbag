package com.kitbag.corenative.library

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

object StemBundleRefusal {
  const val NOT_A_BUNDLE = "not-a-bundle"
  const val UNSUPPORTED_VERSION = "unsupported-version"
  const val TOO_MANY_STEMS = "too-many-stems"
  const val UNREADABLE = "unreadable"
  const val NO_SPACE = "no-space"
}

class StemBundleRefusedException(val refusal: String) : Exception("Stem bundle refused: $refusal")

class ManifestStem(val name: String, val file: String, val frames: Long) {
  val fileName: String get() = file.substring(StemBundleManifest.STEMS_PREFIX.length)
}

class BundleManifest(
  val jobId: String,
  val title: String,
  val durationSec: Double,
  val sampleRate: Int,
  val channels: Int,
  val stems: List<ManifestStem>,
)

class ManifestCheck(
  val refusal: String?,
  val format: String = "",
  val version: Int = 0,
  val jobId: String = "",
  val title: String = "",
  val stemCount: Int = 0,
  val manifest: BundleManifest? = null,
) {
  fun copyWith(refusal: String?, manifest: BundleManifest? = this.manifest) =
    ManifestCheck(refusal, format, version, jobId, title, stemCount, manifest)
}

object StemBundleManifest {
  const val FILE_NAME = "manifest.json"
  const val FORMAT = "stemdeck-song-bundle"
  const val SUPPORTED_VERSION = 1
  const val STEMS_PREFIX = "stems/"
  private const val STEM_EXTENSION = ".flac"
  internal val POSITIVE_INT = 1L..Int.MAX_VALUE

  fun check(text: String?, maxStems: Int): ManifestCheck {
    if (text == null) return ManifestCheck(StemBundleRefusal.NOT_A_BUNDLE)
    val json = try {
      JSONObject(text)
    } catch (e: JSONException) {
      return ManifestCheck(StemBundleRefusal.UNREADABLE)
    }
    val format = json.stringOrNull("format").orEmpty()
    if (format != FORMAT) return ManifestCheck(StemBundleRefusal.NOT_A_BUNDLE, format)
    val version = json.wholeOrNull("version")?.let(::clampToInt)
      ?: return ManifestCheck(StemBundleRefusal.UNREADABLE, format)
    if (version != SUPPORTED_VERSION) {
      return ManifestCheck(StemBundleRefusal.UNSUPPORTED_VERSION, format, version)
    }
    val jobId = json.stringOrNull("job_id").orEmpty()
    val title = json.stringOrNull("title").orEmpty()
    val stems = json.opt("stems") as? JSONArray
    val identity = ManifestCheck(StemBundleRefusal.UNREADABLE, format, version, jobId, title, stems?.length() ?: 0)
    if (stems == null || stems.length() == 0 || jobId.isEmpty()) return identity
    if (stems.length() > maxStems) return identity.copyWith(StemBundleRefusal.TOO_MANY_STEMS)
    val manifest = parseBody(json, jobId, title, stems) ?: return identity
    return identity.copyWith(null, manifest)
  }

  private fun parseBody(json: JSONObject, jobId: String, title: String, stems: JSONArray): BundleManifest? {
    val sampleRate = json.wholeOrNull("sample_rate")?.takeIf { it in POSITIVE_INT } ?: return null
    val channels = json.wholeOrNull("channels")?.takeIf { it in POSITIVE_INT } ?: return null
    val duration = json.finiteOrNull("duration_sec")?.takeIf { it >= 0 } ?: return null
    val parsed = (0 until stems.length()).map { parseStem(stems.opt(it)) ?: return null }
    if (parsed.distinctBy { it.name }.size != parsed.size) return null
    if (parsed.distinctBy { it.fileName.lowercase() }.size != parsed.size) return null
    return BundleManifest(jobId, title, duration, sampleRate.toInt(), channels.toInt(), parsed)
  }

  private fun parseStem(value: Any?): ManifestStem? {
    val stem = value as? JSONObject ?: return null
    val name = stem.stringOrNull("name")?.takeIf { it.isNotEmpty() } ?: return null
    val file = stem.stringOrNull("file")?.takeIf(::isSafeStemFile) ?: return null
    val frames = stem.wholeOrNull("frames")?.takeIf { it > 0 } ?: return null
    return ManifestStem(name, file, frames)
  }

  // The name is written to disk as-is, so it must already be what
  // safeFileName would make of it: no separators, no hidden files.
  internal fun isSafeStemFile(file: String): Boolean {
    if (!file.startsWith(STEMS_PREFIX)) return false
    val name = file.substring(STEMS_PREFIX.length)
    return name.endsWith(STEM_EXTENSION) && LibraryPaths.safeFileName(name, null) == name
  }
}

internal fun JSONObject.stringOrNull(key: String): String? = opt(key) as? String

internal fun JSONObject.finiteOrNull(key: String): Double? = finiteOrNull(opt(key))

internal fun finiteOrNull(value: Any?): Double? = (value as? Number)?.toDouble()?.takeIf { it.isFinite() }

private fun clampToInt(value: Long): Int = value.coerceIn(Int.MIN_VALUE.toLong(), Int.MAX_VALUE.toLong()).toInt()

internal fun JSONObject.wholeOrNull(key: String): Long? {
  val value = finiteOrNull(opt(key)) ?: return null
  return value.toLong().takeIf { it.toDouble() == value }
}
