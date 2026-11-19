package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExportFilesTest {
  private companion object {
    const val CJK_BYTES = 3
    const val EMOJI_BYTES = 4
    const val WAV_BYTES = 4
  }

  @Test
  fun acceptsTheNamesTheAppBuilds() {
    assertEquals("Song - Band.wav", ExportFiles.exportName("Song - Band.wav"))
    assertEquals(
      "Café, live - Bänd (0.75x, -2 st).wav",
      ExportFiles.exportName("Café, live - Bänd (0.75x, -2 st).wav"),
    )
  }

  @Test
  fun capsTheBaseNameInUtf8Bytes() {
    val ascii = "a".repeat(ExportFiles.MAX_BASE_NAME_BYTES + 10)
    assertEquals("${"a".repeat(ExportFiles.MAX_BASE_NAME_BYTES)}.wav", ExportFiles.exportName("$ascii.wav"))
  }

  @Test
  fun trimsCjkOnACharacterBoundary() {
    val name = ExportFiles.exportName("${"歌".repeat(100)}.wav")
    assertEquals("${"歌".repeat(ExportFiles.MAX_BASE_NAME_BYTES / CJK_BYTES)}.wav", name)
  }

  @Test
  fun neverSplitsAnEmoji() {
    val name = ExportFiles.exportName("${"🎸".repeat(100)}.wav")!!
    assertEquals("${"🎸".repeat(ExportFiles.MAX_BASE_NAME_BYTES / EMOJI_BYTES)}.wav", name)
    assertTrue(name.toByteArray(Charsets.UTF_8).size <= ExportFiles.MAX_BASE_NAME_BYTES + WAV_BYTES)
  }

  @Test
  fun refusesNamesThatEscapeOrMislead() {
    assertNull(ExportFiles.exportName("../Song.wav"))
    assertNull(ExportFiles.exportName("dir/Song.wav"))
    assertNull(ExportFiles.exportName(".hidden.wav"))
    assertNull(ExportFiles.exportName("Song.json"))
    assertNull(ExportFiles.exportName(".wav"))
    assertNull(ExportFiles.exportName(" Song.wav"))
    assertNull(ExportFiles.exportName("Song\u0000.wav"))
  }

  @Test
  fun leavesRoomForThePartFileInNameMax() {
    assertEquals(246, ExportFiles.MAX_BASE_NAME_BYTES)
  }

  @Test
  fun resolvesOnlyFilesDirectlyInTheExportsDirectory() {
    val cache = Files.createTempDirectory("kitbag-cache").toFile()
    val exports = ExportFiles.dir(cache).apply { mkdirs() }
    val mix = File(exports, "Song.wav").apply { writeText("x") }
    val outside = File(cache, "other.wav").apply { writeText("x") }
    assertEquals(mix.canonicalFile, ExportFiles.resolve(cache, mix.path))
    assertNull(ExportFiles.resolve(cache, outside.path))
    assertNull(ExportFiles.resolve(cache, "${exports.path}/../other.wav"))
    assertNull(ExportFiles.resolve(cache, File(exports, "missing.wav").path))
    cache.deleteRecursively()
  }

  @Test
  fun clearsEarlierExports() {
    val cache = Files.createTempDirectory("kitbag-cache").toFile()
    val old = File(ExportFiles.dir(cache).apply { mkdirs() }, "Old.wav").apply { writeText("x") }
    ExportFiles.clear(cache)
    assertFalse(old.exists())
    cache.deleteRecursively()
  }
}
