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
  fun `metadata takes the song heading from the tags, then the identified recording`() {
    val tagged = members.metadata(
      """{"title":"Charity Gayle - Echo (In Jesus Name) [LIVE]",
         "audio_tags":{"artist":"Charity Gayle","title":"Echo (In Jesus Name) [LIVE]"},
         "identity":{"artist":"Charity Gayle","title":"Echo"}}""",
    )
    assertEquals("Echo (In Jesus Name) [LIVE]", tagged.heading?.title)
    assertEquals("Charity Gayle", tagged.heading?.artist)
    val identified = members.metadata(
      """{"audio_tags":{"title":"Echo"},"identity":{"artist":"Charity Gayle","title":"Echo"}}""",
    )
    assertEquals("Echo", identified.heading?.title)
    assertEquals("Charity Gayle", identified.heading?.artist)
    assertNull(members.metadata("""{"title":"Charity Gayle - Echo"}""").heading)
  }

  @Test
  fun `the manifest artist wins over the tags, which still name the artist when it has none`() {
    val tagged = members.metadata("""{"audio_tags":{"artist":"Tagged","title":"Echo"}}""")
    assertEquals("Manifest", imported("Manifest", tagged).artist)
    assertEquals("Echo", imported("Manifest", tagged).metadata.heading?.title)
    assertEquals("Tagged", imported(null, tagged).artist)
    assertNull(imported(null, members.metadata("""{"audio_tags":{"artist":"Tagged"}}""")).artist)
    assertNull(imported(null, members.metadata(null)).artist)
  }

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
  fun `the grid's tempo is the song's tempo in either mode`() {
    val detected = members.metadata("""{"bpm":118.4}""")
    val grids = listOf(
      121.5 to """{"beats":[0.5,1.0],"bpm":121.5,"tempo":{"mode":"constant","bpm":121.5,"source":"user"}}""",
      118.9 to """{"beats":[0.5,1.0],"bpm":118.9,"tempo":{"mode":"follow","bpm":120,"source":"detected"}}""",
    )
    for ((bpm, text) in grids) {
      assertEquals(text, bpm, members.bpm(detected, members.grid(text))!!, 0.0)
    }
  }

  @Test
  fun `the detected tempo stands when beats json has no usable bpm`() {
    val detected = members.metadata("""{"bpm":118.4}""")
    val grids = listOf(
      null,
      """{"beats":[0.5,1.0]}""",
      """{"beats":[0.5,1.0],"bpm":0}""",
      """{"beats":[0.5,1.0],"bpm":-120}""",
      """{"beats":[0.5,1.0],"bpm":NaN}""",
      """{"beats":[0.5,1.0],"bpm":1e999}""",
      """{"beats":[0.5,1.0],"bpm":"120"}""",
      """{"beats":[0.5,1.0],"bpm":null}""",
      """{"beats":[0.5,1.0],"tempo":{"mode":"constant","bpm":120}}""",
    )
    for (text in grids) {
      assertEquals(text, 118.4, members.bpm(detected, members.grid(text))!!, 0.0)
    }
  }

  @Test
  fun `the bundle tempo reads back in either mode, fit ignored`() {
    val constant = members.grid(
      """{"beats":[0.0,0.5],"bpm":120,"tempo":{"mode":"constant","bpm":120,"anchor":0.0,
         "beats_per_bar":4,"source":"detected"}}""",
    ).tempo!!
    assertEquals(listOf("constant", "detected"), listOf(constant.mode, constant.source))
    assertEquals(120.0, constant.bpm!!, 0.0)
    assertEquals(0.0, constant.anchor!!, 0.0)
    assertEquals(4, constant.beatsPerBar)
    val follow = members.grid(
      """{"beats":[0.4,0.9],"tempo":{"mode":"follow","bpm":127.3,"anchor":0.42,"beats_per_bar":3,
         "source":"user","fit":{"method":"theil-sen","max_drift_ms":"lots"}}}""",
    ).tempo!!
    assertEquals(listOf("follow", "user"), listOf(follow.mode, follow.source))
    assertEquals(127.3, follow.bpm!!, 0.0)
    assertEquals(0.42, follow.anchor!!, 0.0)
    assertEquals(3, follow.beatsPerBar)
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `the bundle tempo passes through unjudged, range and words left to the library`() {
    val tempo = members.grid(
      tempoGrid(""""mode":"steady"""", """"bpm":500""", """"anchor":-1""", """"beats_per_bar":33""", """"source":"x""""),
    ).tempo!!
    assertEquals(listOf("steady", "x"), listOf(tempo.mode, tempo.source))
    assertEquals(500.0, tempo.bpm!!, 0.0)
    assertEquals(-1.0, tempo.anchor!!, 0.0)
    assertEquals(33, tempo.beatsPerBar)
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `a grid without a tempo has none and warns nothing`() {
    assertNull(members.grid("""{"beats":[0.5,1.0]}""").tempo)
    assertNull(members.grid("""{"beats":[0.5,1.0],"tempo":null}""").tempo)
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `a follow tempo StemDeck found no bpm or anchor for reads back with neither and no warning`() {
    val untimed = members.grid(
      """{"beats":[0.5,1.0],"tempo":{"mode":"follow","beats_per_bar":4,"source":"detected"}}""",
    ).tempo!!
    assertEquals("follow", untimed.mode)
    assertNull(untimed.bpm)
    assertNull(untimed.anchor)
    assertEquals(4, untimed.beatsPerBar)
    assertNull(members.grid(tempoGrid(""""bpm":null""", """"anchor":null""")).tempo!!.bpm)
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `a follow tempo with only a bpm or only an anchor reads back with the other absent`() {
    val bpmOnly = members.grid(tempoGrid(""""anchor":null""")).tempo!!
    assertEquals(120.0, bpmOnly.bpm!!, 0.0)
    assertNull(bpmOnly.anchor)
    val anchorOnly = members.grid(tempoGrid(""""bpm":null""")).tempo!!
    assertNull(anchorOnly.bpm)
    assertEquals(0.5, anchorOnly.anchor!!, 0.0)
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `every tempo word StemDeck's tempo_grid py writes passes through as written`() {
    for (mode in listOf("constant", "follow")) {
      for (source in listOf("detected", "user")) {
        val tempo = members.grid(tempoGrid(""""mode":"$mode"""", """"source":"$source"""")).tempo
        assertEquals("$mode/$source", listOf(mode, source), listOf(tempo?.mode, tempo?.source))
      }
    }
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `a wrongly shaped tempo is dropped with a warning and the beats are kept`() {
    val bad = listOf(
      """"mode":null""", """"mode":7""", """"source":null""",
      """"bpm":"120"""", """"bpm":NaN""", """"anchor":"0"""",
      """"beats_per_bar":4.5""", """"beats_per_bar":null""", """"beats_per_bar":1e12""",
    )
    for (field in bad) {
      val grid = members.grid(tempoGrid(field))
      assertNull(field, grid.tempo)
      assertEquals(field, 2, grid.beats.size)
    }
    assertNull(members.grid("""{"beats":[0.5,1.0],"tempo":"constant"}""").tempo)
    assertEquals(bad.size + 1, warnings.size)
  }

  private fun tempoGrid(vararg overrides: String): String {
    val fields = linkedMapOf(
      "mode" to "\"follow\"", "bpm" to "120", "anchor" to "0.5", "beats_per_bar" to "4", "source" to "\"detected\"",
    )
    for (override in overrides) {
      val (key, value) = override.split(":", limit = 2)
      fields[key.trim('"')] = value
    }
    val tempo = fields.entries.joinToString(",") { (k, v) -> "\"$k\":$v" }
    return """{"beats":[0.5,1.0],"tempo":{$tempo}}"""
  }

  @Test
  fun `a song with no tempo anywhere has no bpm`() {
    assertNull(members.bpm(members.metadata(null), members.grid(null)))
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
    )!!
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
    assertNull(members.mix(null, listOf("a")))
    assertNull(members.mix("nonsense", listOf("a")))
    assertNull(members.mix("{}", listOf("a")))
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

  private fun imported(artist: String?, metadata: BundleMetadata) =
    ImportedBundle(
      BundleManifest("job", "Echo", artist, 1.0, 44100, 2, emptyList()),
      "stems/job",
      emptyList(),
      metadata,
      BundleGrid(),
      null,
      null,
      false,
    )
}
