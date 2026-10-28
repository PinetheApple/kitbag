package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class StemBundleImporterTest {
  private lateinit var root: File
  private lateinit var base: File
  private var free = Long.MAX_VALUE
  private val written = mutableMapOf<String, Pair<Long, FloatArray>>()
  private val stems = listOf("vocals", "drums")

  private fun importer(sidecars: WaveformSidecarWriter = recordingSidecars()) =
    StemBundleImporter(base, MAX_STEMS, { free }, sidecars) { _, _ -> }

  private fun recordingSidecars() = WaveformSidecarWriter { stem, frames, peaks ->
    written[stem.name] = frames to peaks
    File(stem.parentFile, stem.nameWithoutExtension + ".kwav").apply { writeBytes(byteArrayOf(1)) }
  }

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stem-bundle").toFile()
    base = File(root, "library").apply { mkdirs() }
  }

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun `a bundle imports its stems, sidecars and every member`() {
    val bundle = BundleFixtures.bundle(
      stems,
      "metadata.json" to """{"bpm":123,"key":"F maj","sections":[{"name":"Intro","start":0,"end":1}]}""".toByteArray(),
      "beats.json" to """{"beats":[0.5,1.0],"bars":[{"beat":0,"beats_per_bar":4}]}""".toByteArray(),
      "lyrics.json" to """{"synced":"[00:01.00] la","plain":null,"instrumental":false}""".toByteArray(),
      "mix.json" to """{"stems":{"drums":{"volume":0.8,"muted":true}}}""".toByteArray(),
      "peaks.json" to """{"vocals":[[-0.5,0.5]],"mix":[[0,0]]}""".toByteArray(),
    )
    val imported = importer().import(BundleFixtures.source(bundle))

    assertEquals("stems/job123", imported.relativeDir)
    val folder = File(base, imported.relativeDir)
    assertEquals(listOf("drums.flac", "vocals.flac", "vocals.kwav"), BundleFixtures.listTree(folder))
    assertArrayEquals(BundleFixtures.stemBytes("drums"), File(folder, "drums.flac").readBytes())
    assertEquals(listOf("stems/job123/vocals.flac", "stems/job123/drums.flac"), imported.stems.map { it.relativePath })
    assertEquals("stems/job123/vocals.kwav", imported.stems[0].waveformRelativePath)
    assertEquals("", imported.stems[1].waveformRelativePath)
    assertEquals(BundleFixtures.FRAMES, written.getValue("vocals.flac").first)
    assertArrayEquals(floatArrayOf(-0.5f, 0.5f), written.getValue("vocals.flac").second, 0f)
    assertEquals(0.8, imported.stems[1].mix.volume, 0.0)
    assertTrue(imported.stems[1].mix.muted)
    assertEquals(1.0, imported.stems[0].mix.volume, 0.0)
    assertEquals(123.0, imported.metadata.bpm!!, 0.0)
    assertEquals("Intro", imported.metadata.sections.single().name)
    assertArrayEquals(doubleArrayOf(0.5, 1.0), imported.grid.beats, 0.0)
    assertEquals(4, imported.grid.bars.single().beatsPerBar)
    assertEquals("[00:01.00] la", imported.lyrics!!.synced)
    assertFalse(File(base, "stems/${StemBundleImporter.STAGING_DIR_NAME}").exists())
  }

  @Test
  fun `a bundle with only the manifest and stems imports`() {
    val imported = importer().import(BundleFixtures.source(BundleFixtures.bundle(stems)))
    assertEquals(2, imported.stems.size)
    assertNull(imported.metadata.bpm)
    assertEquals(0, imported.grid.beats.size)
    assertNull(imported.lyrics)
    assertTrue(written.isEmpty())
  }

  @Test
  fun `a malformed optional member is absent, not a failure`() {
    val bundle = BundleFixtures.bundle(
      stems,
      "metadata.json" to "{".toByteArray(),
      "beats.json" to "[".toByteArray(),
      "peaks.json" to "nope".toByteArray(),
    )
    val imported = importer().import(BundleFixtures.source(bundle))
    assertNull(imported.metadata.bpm)
    assertEquals(0, imported.grid.beats.size)
    assertEquals("", imported.stems[0].waveformRelativePath)
  }

  @Test
  fun `entries outside the whitelist are never written`() {
    val bundle = BundleFixtures.bundle(
      stems,
      "../evil.flac" to "x".toByteArray(),
      "stems/../../evil.flac" to "x".toByteArray(),
      "/abs.flac" to "x".toByteArray(),
      "stems/unlisted.flac" to "x".toByteArray(),
      "stems/nested" to null,
      "vocal_envelope.json" to "{}".toByteArray(),
      "readme.txt" to "x".toByteArray(),
    )
    val imported = importer().import(BundleFixtures.source(bundle))
    assertEquals(
      listOf("library/stems/job123/drums.flac", "library/stems/job123/vocals.flac"),
      BundleFixtures.listTree(root),
    )
    assertEquals(2, imported.stems.size)
  }

  @Test
  fun `a manifest that is not the first entry is still found`() {
    val bundle = BundleFixtures.zip(
      "stems/vocals.flac" to BundleFixtures.stemBytes("vocals"),
      StemBundleManifest.FILE_NAME to BundleFixtures.manifest(listOf("vocals")).toByteArray(),
    )
    assertEquals(StemBundleRefusal.NONE, importer().check(BundleFixtures.source(bundle)).refusal)
    assertEquals(1, importer().import(BundleFixtures.source(bundle)).stems.size)
  }

  @Test
  fun `a stem the manifest lists but the bundle lacks fails and leaves nothing`() {
    val bundle = BundleFixtures.zip(
      StemBundleManifest.FILE_NAME to BundleFixtures.manifest(stems).toByteArray(),
      "stems/vocals.flac" to BundleFixtures.stemBytes("vocals"),
    )
    try {
      importer().import(BundleFixtures.source(bundle))
      fail("a missing stem must fail the import")
    } catch (e: IOException) {
      assertEquals(emptyList<String>(), BundleFixtures.listTree(root))
    }
  }

  @Test
  fun `a refused bundle throws its refusal and copies nothing`() {
    val notBundle = BundleFixtures.zip("readme.txt" to "x".toByteArray())
    val tooMany = BundleFixtures.bundle((1..MAX_STEMS + 1).map { "lane$it" })
    val cases = mapOf(
      notBundle to StemBundleRefusal.NOT_A_BUNDLE,
      "not a zip at all".toByteArray() to StemBundleRefusal.NOT_A_BUNDLE,
      tooMany to StemBundleRefusal.TOO_MANY_STEMS,
      BundleFixtures.zip("manifest.json" to "{".toByteArray()) to StemBundleRefusal.UNREADABLE,
    )
    for ((bytes, refusal) in cases) {
      assertEquals(refusal, importer().check(BundleFixtures.source(bytes)).refusal)
      try {
        importer().import(BundleFixtures.source(bytes))
        fail("expected $refusal")
      } catch (e: StemBundleRefusedException) {
        assertEquals(refusal, e.refusal)
      }
    }
    assertEquals(emptyList<String>(), BundleFixtures.listTree(root))
  }

  @Test
  fun `a bundle larger than the free space is refused`() {
    val bundle = BundleFixtures.bundle(stems)
    free = bundle.size.toLong() - 1
    assertEquals(StemBundleRefusal.NO_SPACE, importer().check(BundleFixtures.source(bundle)).refusal)
    free = bundle.size.toLong()
    assertEquals(StemBundleRefusal.NONE, importer().check(BundleFixtures.source(bundle)).refusal)
    free = 0
    val unknownSize = BundleFixtures.source(bundle, BundleSource.UNKNOWN_SIZE)
    assertEquals(StemBundleRefusal.NONE, importer().check(unknownSize).refusal)
  }

  @Test
  fun `a second import of the same job gets its own folder`() {
    val bundle = BundleFixtures.bundle(stems)
    assertEquals("stems/job123", importer().import(BundleFixtures.source(bundle)).relativeDir)
    assertEquals("stems/job123-2", importer().import(BundleFixtures.source(bundle)).relativeDir)
  }

  @Test
  fun `staging left by a killed import is cleared by the next one`() {
    val leftover = File(base, "stems/${StemBundleImporter.STAGING_DIR_NAME}/vocals.flac")
    leftover.parentFile!!.mkdirs()
    leftover.writeText("partial")
    importer().import(BundleFixtures.source(BundleFixtures.bundle(stems)))
    assertFalse(leftover.parentFile!!.exists())
  }

  @Test
  fun `a sidecar that cannot be written leaves the stem without a waveform`() {
    val bundle = BundleFixtures.bundle(stems, "peaks.json" to """{"vocals":[[0,1]]}""".toByteArray())
    val imported = importer { _, _, _ -> null }.import(BundleFixtures.source(bundle))
    assertEquals("", imported.stems[0].waveformRelativePath)
  }

  @Test
  fun `an over-cap member reads as absent`() {
    val chunk = "[0,0],"
    val huge = "{\"vocals\":[" + chunk.repeat(5 * 1024 * 1024 / chunk.length) + "[0,0]]}"
    val bundle = BundleFixtures.bundle(stems, "peaks.json" to huge.toByteArray())
    val imported = importer().import(BundleFixtures.source(bundle))
    assertEquals("", imported.stems[0].waveformRelativePath)
    assertTrue(written.isEmpty())
  }

  private companion object {
    const val MAX_STEMS = 16
  }
}
