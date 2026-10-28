package com.kitbag.corenative.library

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

class BundleSection(val name: String, val kind: String, val color: String, val startSec: Double, val endSec: Double)

class BundleMetadata(
  val bpm: Double? = null,
  val key: String? = null,
  val scale: String? = null,
  val keyConfidence: Double? = null,
  val loudnessLufs: Double? = null,
  val tempoStability: Double? = null,
  val sections: List<BundleSection> = emptyList(),
)

class BundleBar(val beat: Int, val beatsPerBar: Int)

class BundleGrid(val beats: DoubleArray = DoubleArray(0), val bars: List<BundleBar> = emptyList())

class BundleLyrics(val synced: String?, val plain: String?, val offsetSec: Double, val instrumental: Boolean)

class StemMix(val volume: Double = 1.0, val muted: Boolean = false, val soloed: Boolean = false, val pitch: Double = 0.0)

typealias BundleWarning = (message: String, cause: Throwable?) -> Unit

// Optional members: a malformed one reads as absent rather than failing the import.
class StemBundleMembers(private val warn: BundleWarning) {

  fun metadata(text: String?): BundleMetadata {
    val json = parse(text, METADATA) ?: return BundleMetadata()
    return BundleMetadata(
      bpm = json.finiteOrNull("bpm"),
      key = json.stringOrNull("key"),
      scale = json.stringOrNull("scale"),
      keyConfidence = json.finiteOrNull("key_confidence"),
      loudnessLufs = json.finiteOrNull("lufs"),
      tempoStability = json.finiteOrNull("tempo_stability"),
      sections = objects(json.opt("sections")).mapNotNull(::section),
    )
  }

  private fun section(json: JSONObject): BundleSection? {
    val start = json.finiteOrNull("start") ?: return null
    val end = json.finiteOrNull("end")?.takeIf { it >= start } ?: return null
    return BundleSection(
      name = json.stringOrNull("name").orEmpty(),
      kind = json.stringOrNull("kind").orEmpty(),
      color = json.stringOrNull("color").orEmpty(),
      startSec = start,
      endSec = end,
    )
  }

  fun grid(text: String?): BundleGrid {
    val json = parse(text, BEATS) ?: return BundleGrid()
    val beats = beatTimes(json.opt("beats"))
    if (beats == null) {
      warn("$BEATS: beats are not strictly increasing finite numbers; grid dropped", null)
      return BundleGrid()
    }
    val bars = barMarks(json.opt("bars"), beats.size)
    if (bars == null) warn("$BEATS: bar marks out of range or order; bars dropped", null)
    return BundleGrid(beats, bars.orEmpty())
  }

  private fun beatTimes(value: Any?): DoubleArray? {
    val array = value as? JSONArray ?: return null
    val beats = DoubleArray(array.length())
    for (i in beats.indices) {
      beats[i] = finiteOrNull(array.opt(i)) ?: return null
      if (i > 0 && beats[i] <= beats[i - 1]) return null
    }
    return beats
  }

  private fun barMarks(value: Any?, beatCount: Int): List<BundleBar>? {
    if (value == null || value == JSONObject.NULL) return emptyList()
    val array = value as? JSONArray ?: return null
    val bars = ArrayList<BundleBar>(array.length())
    for (i in 0 until array.length()) {
      val mark = array.opt(i) as? JSONObject ?: return null
      val beat = mark.wholeOrNull("beat")?.takeIf { it >= 0 && it < beatCount } ?: return null
      val perBar = mark.wholeOrNull("beats_per_bar")?.takeIf { it in StemBundleManifest.POSITIVE_INT } ?: return null
      if (bars.isNotEmpty() && beat <= bars.last().beat) return null
      bars += BundleBar(beat.toInt(), perBar.toInt())
    }
    return bars
  }

  fun lyrics(text: String?): BundleLyrics? {
    val json = parse(text, LYRICS) ?: return null
    return BundleLyrics(
      synced = json.stringOrNull("synced"),
      plain = json.stringOrNull("plain"),
      offsetSec = json.finiteOrNull("offset_sec") ?: 0.0,
      instrumental = json.opt("instrumental") as? Boolean ?: false,
    )
  }

  fun mix(text: String?, stemNames: Collection<String>): Map<String, StemMix> {
    val stems = parse(text, MIX)?.opt("stems") as? JSONObject
    return stemNames.associateWith { name ->
      val lane = stems?.opt(name) as? JSONObject ?: return@associateWith StemMix()
      StemMix(
        volume = lane.finiteOrNull("volume") ?: StemMix().volume,
        muted = lane.opt("muted") as? Boolean ?: false,
        soloed = lane.opt("soloed") as? Boolean ?: false,
        pitch = lane.finiteOrNull("pitch") ?: StemMix().pitch,
      )
    }
  }

  // Each stem's overview as interleaved [min, max] per chunk.
  fun peaks(text: String?, stemNames: Collection<String>): Map<String, FloatArray> {
    val json = parse(text, PEAKS) ?: return emptyMap()
    return stemNames.mapNotNull { name -> stemPeaks(json.opt(name))?.let { name to it } }.toMap()
  }

  private fun stemPeaks(value: Any?): FloatArray? {
    val chunks = value as? JSONArray ?: return null
    if (chunks.length() == 0) return null
    val out = FloatArray(chunks.length() * PEAK_VALUES_PER_CHUNK)
    for (i in 0 until chunks.length()) {
      val pair = chunks.opt(i) as? JSONArray ?: return null
      if (pair.length() != PEAK_VALUES_PER_CHUNK) return null
      for (j in 0 until PEAK_VALUES_PER_CHUNK) {
        out[i * PEAK_VALUES_PER_CHUNK + j] = (pair.opt(j) as? Number)?.toFloat() ?: return null
      }
    }
    return out
  }

  private fun objects(value: Any?): List<JSONObject> {
    val array = value as? JSONArray ?: return emptyList()
    return (0 until array.length()).mapNotNull { array.opt(it) as? JSONObject }
  }

  private fun parse(text: String?, member: String): JSONObject? {
    if (text == null) return null
    return try {
      JSONObject(text)
    } catch (e: JSONException) {
      warn("$member is malformed; treated as absent", e)
      null
    }
  }

  companion object {
    const val METADATA = "metadata.json"
    const val BEATS = "beats.json"
    const val LYRICS = "lyrics.json"
    const val MIX = "mix.json"
    const val PEAKS = "peaks.json"
    val ALL = setOf(METADATA, BEATS, LYRICS, MIX, PEAKS)
    const val PEAK_VALUES_PER_CHUNK = 2
  }
}
