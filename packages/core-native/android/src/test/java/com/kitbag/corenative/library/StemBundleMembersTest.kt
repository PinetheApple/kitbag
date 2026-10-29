package com.kitbag.corenative.library

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StemBundleMembersTest {
  private val warnings = mutableListOf<String>()
  private val members = StemBundleMembers { message, _ -> warnings += message }

  @Test
  fun `metadata reads the fields a player uses and ignores the rest`() {
    val metadata = members.metadata(
      """{"title":"Echo","bpm":123,"key":"F maj","scale":"Major","key_confidence":100,
         "lufs":-9.35,"tempo_stability":97,"stem_presence":{"vocals":100},
         "sections":[{"id":"a","name":"Intro","kind":"intro","start":0.0,"end":19.033,"color":"#4a7fff"},
                     {"id":"b","name":"Verse","start":19.033,"end":46.873}]}""",
    )
    assertEquals(123.0, metadata.bpm!!, 0.0)
    assertEquals("F maj", metadata.key)
    assertEquals("Major", metadata.scale)
    assertEquals(100.0, metadata.keyConfidence!!, 0.0)
    assertEquals(-9.35, metadata.loudnessLufs!!, 0.0)
    assertEquals(97.0, metadata.tempoStability!!, 0.0)
    assertEquals(listOf("Intro", "Verse"), metadata.sections.map { it.name })
    assertEquals("intro", metadata.sections[0].kind)
    assertEquals("#4a7fff", metadata.sections[0].color)
    assertEquals("", metadata.sections[1].kind)
    assertEquals(19.033, metadata.sections[0].endSec, 0.0)
  }

  @Test
  fun `missing or malformed metadata reads as empty, with a warning only when malformed`() {
    val absent = members.metadata(null)
    assertNull(absent.bpm)
    assertTrue(absent.sections.isEmpty())
    assertTrue(warnings.isEmpty())

    val broken = members.metadata("{\"bpm\": 12")
    assertNull(broken.bpm)
    assertEquals(1, warnings.size)
  }

  @Test
  fun `wrongly typed metadata fields and sections are dropped one by one`() {
    val metadata = members.metadata(
      """{"bpm":"fast","key":7,"sections":[{"name":"x","start":"0","end":1},
         {"name":"backwards","start":5,"end":1},{"name":"ok","start":1,"end":2}, 4]}""",
    )
    assertNull(metadata.bpm)
    assertNull(metadata.key)
    assertEquals(listOf("ok"), metadata.sections.map { it.name })
  }

  @Test
  fun `beats and bar marks read back`() {
    val grid = members.grid(
      """{"beats":[0.5,1.0,1.5,2.0,2.5],"bars":[{"beat":0,"beats_per_bar":4},{"beat":4,"beats_per_bar":3}],
         "onsets":[1,2],"bpm":120}""",
    )
    assertArrayEquals(doubleArrayOf(0.5, 1.0, 1.5, 2.0, 2.5), grid.beats, 0.0)
    assertEquals(listOf(0 to 4, 4 to 3), grid.bars.map { it.beat to it.beatsPerBar })
  }

  @Test
  fun `beats that are not strictly increasing finite numbers drop the whole grid`() {
    val bad = listOf("[1.0,1.0]", "[2.0,1.0]", "[1.0,\"2\"]", "[1.0,null]", "\"1,2\"")
    for (beats in bad) {
      val grid = members.grid("""{"beats":$beats,"bars":[{"beat":0,"beats_per_bar":4}]}""")
      assertEquals(beats, 0, grid.beats.size)
      assertEquals(beats, 0, grid.bars.size)
    }
    assertEquals(bad.size, warnings.size)
  }

  @Test
  fun `bar marks out of range or order are dropped but the beats are kept`() {
    val bad = listOf(
      """[{"beat":5,"beats_per_bar":4}]""",
      """[{"beat":0,"beats_per_bar":0}]""",
      """[{"beat":2,"beats_per_bar":4},{"beat":1,"beats_per_bar":4}]""",
      """[{"beat":0.5,"beats_per_bar":4}]""",
      """{"beat":0}""",
    )
    for (bars in bad) {
      val grid = members.grid("""{"beats":[0,1,2],"bars":$bars}""")
      assertEquals(bars, 3, grid.beats.size)
      assertEquals(bars, 0, grid.bars.size)
    }
    assertEquals(0, members.grid("""{"beats":[0,1]}""").bars.size)
  }

  @Test
  fun `lyrics read back, with offset and instrumental defaulted`() {
    val lyrics = members.lyrics("""{"synced":"[00:19.92] You moved","plain":null,"source":"lrclib"}""")!!
    assertEquals("[00:19.92] You moved", lyrics.synced)
    assertNull(lyrics.plain)
    assertEquals(0.0, lyrics.offsetSec, 0.0)
    assertFalse(lyrics.instrumental)

    val shifted = members.lyrics("""{"synced":null,"plain":"la","offset_sec":-0.25,"instrumental":true}""")!!
    assertEquals(-0.25, shifted.offsetSec, 0.0)
    assertTrue(shifted.instrumental)
    assertNull(members.lyrics(null))
    assertNull(members.lyrics("[]"))
  }

  @Test
  fun `the mix applies per stem and defaults lanes it does not name`() {
    val mix = members.mix(
      """{"stems":{"drums":{"volume":0.8,"muted":true,"soloed":true,"pitch":-2},"other":{"volume":"loud"}}}""",
      listOf("drums", "bass", "other"),
    )
    assertEquals(0.8, mix.getValue("drums").volume, 0.0)
    assertTrue(mix.getValue("drums").muted)
    assertTrue(mix.getValue("drums").soloed)
    assertEquals(-2.0, mix.getValue("drums").pitch, 0.0)
    for (lane in listOf("bass", "other")) {
      assertEquals(1.0, mix.getValue(lane).volume, 0.0)
      assertFalse(mix.getValue(lane).muted)
      assertFalse(mix.getValue(lane).soloed)
      assertEquals(0.0, mix.getValue(lane).pitch, 0.0)
    }
    assertEquals(setOf("a"), members.mix(null, listOf("a")).keys)
    assertEquals(1.0, members.mix("nonsense", listOf("a")).getValue("a").volume, 0.0)
  }

  @Test
  fun `peaks flatten to min-max pairs per stem and ignore other keys`() {
    val peaks = members.peaks(
      """{"vocals":[[-0.5,0.5],[-0.25,1]],"mix":[[0,0]],"drums":[[0,0.5],[1]],"bass":[]}""",
      listOf("vocals", "drums", "bass", "piano"),
    )
    assertEquals(setOf("vocals"), peaks.keys)
    assertArrayEquals(floatArrayOf(-0.5f, 0.5f, -0.25f, 1f), peaks.getValue("vocals"), 0f)
    assertTrue(members.peaks("{oops", listOf("vocals")).isEmpty())
  }
}
