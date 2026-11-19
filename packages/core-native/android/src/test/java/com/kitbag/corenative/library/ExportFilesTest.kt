package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExportFilesTest {
  @Test
  fun acceptsTheNamesTheAppBuilds() {
    assertTrue(ExportFiles.isSafeFileName("Song - Band.wav"))
    assertTrue(ExportFiles.isSafeFileName("Café, live - Bänd (0.75x, -2 st).wav"))
    assertTrue(ExportFiles.isSafeFileName("${"a".repeat(ExportFiles.MAX_BASE_NAME_CHARS)}.wav"))
  }

  @Test
  fun refusesNamesThatEscapeOrMislead() {
    assertFalse(ExportFiles.isSafeFileName("../Song.wav"))
    assertFalse(ExportFiles.isSafeFileName("dir/Song.wav"))
    assertFalse(ExportFiles.isSafeFileName(".hidden.wav"))
    assertFalse(ExportFiles.isSafeFileName("Song.json"))
    assertFalse(ExportFiles.isSafeFileName(".wav"))
    assertFalse(ExportFiles.isSafeFileName(" Song.wav"))
    assertFalse(ExportFiles.isSafeFileName("Song\u0000.wav"))
    assertFalse(ExportFiles.isSafeFileName("${"a".repeat(ExportFiles.MAX_BASE_NAME_CHARS + 1)}.wav"))
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
