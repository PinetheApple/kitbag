package com.kitbag.corenative.library

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StemBundleManifestTest {
  private val maxStems = 16

  @Test
  fun `a StemDeck manifest is accepted with its identity and stems`() {
    val check = StemBundleManifest.check(BundleFixtures.manifest(listOf("vocals", "drums")), maxStems)
    assertEquals(StemBundleRefusal.NONE, check.refusal)
    assertEquals("job123", check.jobId)
    assertEquals("Echo", check.title)
    assertEquals(2, check.stemCount)
    val manifest = assertNotNullAnd(check.manifest)
    assertEquals(44100, manifest.sampleRate)
    assertEquals(2, manifest.channels)
    assertEquals(listOf("vocals", "drums"), manifest.stems.map { it.name })
    assertEquals("vocals.flac", manifest.stems[0].fileName)
    assertEquals(BundleFixtures.FRAMES, manifest.stems[0].frames)
  }

  @Test
  fun `no manifest or another format is not a bundle`() {
    assertEquals(StemBundleRefusal.NOT_A_BUNDLE, StemBundleManifest.check(null, maxStems).refusal)
    val other = BundleFixtures.manifestJson(listOf("vocals")).put("format", "something-else").toString()
    val check = StemBundleManifest.check(other, maxStems)
    assertEquals(StemBundleRefusal.NOT_A_BUNDLE, check.refusal)
    assertEquals("something-else", check.format)
    val missing = BundleFixtures.manifestJson(listOf("vocals")).apply { remove("format") }.toString()
    assertEquals(StemBundleRefusal.NOT_A_BUNDLE, StemBundleManifest.check(missing, maxStems).refusal)
  }

  @Test
  fun `another version is refused and reports the version found`() {
    val v2 = BundleFixtures.manifestJson(listOf("vocals")).put("version", 2).toString()
    val check = StemBundleManifest.check(v2, maxStems)
    assertEquals(StemBundleRefusal.UNSUPPORTED_VERSION, check.refusal)
    assertEquals(2, check.version)
    assertNull(check.manifest)
  }

  @Test
  fun `more stems than the mixer holds are refused, not truncated`() {
    val names = (1..maxStems + 1).map { "lane$it" }
    val check = StemBundleManifest.check(BundleFixtures.manifest(names), maxStems)
    assertEquals(StemBundleRefusal.TOO_MANY_STEMS, check.refusal)
    assertEquals(maxStems + 1, check.stemCount)
    val atLimit = StemBundleManifest.check(BundleFixtures.manifest(names.take(maxStems)), maxStems)
    assertEquals(StemBundleRefusal.NONE, atLimit.refusal)
  }

  @Test
  fun `a malformed manifest is unreadable`() {
    val cases = listOf(
      "{not json",
      "",
      BundleFixtures.manifestJson(listOf("vocals")).put("version", "1").toString(),
      BundleFixtures.manifestJson(listOf("vocals")).put("version", 1.5).toString(),
      BundleFixtures.manifestJson(emptyList()).toString(),
      BundleFixtures.manifestJson(listOf("vocals")).put("job_id", "").toString(),
      BundleFixtures.manifestJson(listOf("vocals")).put("sample_rate", 0).toString(),
      BundleFixtures.manifestJson(listOf("vocals")).put("stems", JSONArray().put("vocals")).toString(),
      BundleFixtures.manifestJson(listOf("vocals", "vocals")).toString(),
      withStem(JSONObject().put("name", "vocals").put("file", "stems/vocals.flac").put("frames", 0)),
    )
    for (case in cases) {
      assertEquals(case, StemBundleRefusal.UNREADABLE, StemBundleManifest.check(case, maxStems).refusal)
    }
  }

  @Test
  fun `a stem file that could escape or is not a stems FLAC is unreadable`() {
    val unsafe = listOf(
      "stems/../../evil.flac",
      "../stems/vocals.flac",
      "/stems/vocals.flac",
      "stems/sub/vocals.flac",
      "stems/.hidden.flac",
      "stems/vocals.wav",
      "vocals.flac",
      "stems/a\\b.flac",
    )
    for (file in unsafe) {
      assertFalse(file, StemBundleManifest.isSafeStemFile(file))
      val manifest = withStem(JSONObject().put("name", "vocals").put("file", file).put("frames", 10))
      assertEquals(file, StemBundleRefusal.UNREADABLE, StemBundleManifest.check(manifest, maxStems).refusal)
    }
    assertTrue(StemBundleManifest.isSafeStemFile("stems/lead_vocals.flac"))
  }

  @Test
  fun `two stems sharing a file name up to case are unreadable`() {
    val stems = JSONArray()
      .put(JSONObject().put("name", "a").put("file", "stems/x.flac").put("frames", 10))
      .put(JSONObject().put("name", "b").put("file", "stems/X.flac").put("frames", 10))
    val manifest = BundleFixtures.manifestJson(listOf("vocals")).put("stems", stems).toString()
    assertEquals(StemBundleRefusal.UNREADABLE, StemBundleManifest.check(manifest, maxStems).refusal)
  }

  @Test
  fun `unknown fields and stem names are kept rather than refused`() {
    val manifest = BundleFixtures.manifestJson(listOf("theremin")).put("future_field", JSONObject()).toString()
    assertEquals(StemBundleRefusal.NONE, StemBundleManifest.check(manifest, maxStems).refusal)
  }

  private fun withStem(stem: JSONObject) =
    BundleFixtures.manifestJson(listOf("vocals")).put("stems", JSONArray().put(stem)).toString()

  private fun <T> assertNotNullAnd(value: T?): T {
    assertNotNull(value)
    return value!!
  }
}
