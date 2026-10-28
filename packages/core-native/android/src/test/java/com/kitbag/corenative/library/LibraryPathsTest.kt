package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test

class LibraryPathsTest {
  private lateinit var root: File
  private lateinit var base: File

  @Before
  fun setUp() {
    root = Files.createTempDirectory("library-paths").toFile()
    base = File(root, "library").apply { mkdirs() }
  }

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun `a relative path resolves under the base`() {
    assertEquals(File(base.canonicalFile, "songs/a.mp3"), LibraryPaths.resolve(base, "songs/a.mp3"))
    assertEquals(File(base.canonicalFile, "songs/a.mp3"), LibraryPaths.resolve(base, "./songs//a.mp3"))
  }

  @Test
  fun `paths that escape the base are rejected`() {
    for (path in listOf("../x", "songs/../../x", "songs/..", "/etc/passwd", "..")) {
      assertThrows(path, UnsafeLibraryPathException::class.java) { LibraryPaths.resolve(base, path) }
    }
  }

  @Test
  fun `a symlink out of the base is rejected`() {
    val outside = File(root, "outside").apply { mkdirs() }
    Files.createSymbolicLink(File(base, "link").toPath(), outside.toPath())
    assertThrows(UnsafeLibraryPathException::class.java) { LibraryPaths.resolve(base, "link/x") }
  }

  @Test
  fun `the base itself resolves only when allowed`() {
    assertThrows(UnsafeLibraryPathException::class.java) { LibraryPaths.resolve(base, "") }
    assertThrows(UnsafeLibraryPathException::class.java) { LibraryPaths.resolve(base, ".") }
    assertEquals(base.canonicalFile, LibraryPaths.resolve(base, "", allowBase = true))
  }

  @Test
  fun `relativize returns a forward-slash path under the base`() {
    assertEquals("songs/a.mp3", LibraryPaths.relativize(base, File(base, "songs/a.mp3")))
  }

  @Test
  fun `a display name becomes a safe name keeping its extension`() {
    assertEquals("My Song (live).mp3", LibraryPaths.safeFileName("My Song (live).MP3", null))
    assertEquals("a_b_c.flac", LibraryPaths.safeFileName("a\\b:c.flac", null))
    assertEquals("Café 日本.ogg", LibraryPaths.safeFileName("Café 日本.ogg", null))
  }

  @Test
  fun `a name never yields a hidden file, an escape, or an empty stem`() {
    assertEquals("hidden.wav", LibraryPaths.safeFileName(".hidden.wav", null))
    assertEquals("audio", LibraryPaths.safeFileName("..", null))
    assertEquals("audio.mp3", LibraryPaths.safeFileName("", "mp3"))
    assertEquals("audio.mp3", LibraryPaths.safeFileName(null, "mp3"))
    assertEquals("evil.mp3", LibraryPaths.safeFileName("../../evil.mp3", null))
  }

  @Test
  fun `a name without an extension takes the fallback`() {
    assertEquals("track.m4a", LibraryPaths.safeFileName("track", "m4a"))
    assertEquals("track", LibraryPaths.safeFileName("track", null))
  }

  @Test
  fun `long names are capped`() {
    val name = LibraryPaths.safeFileName("x".repeat(500) + "." + "y".repeat(50), null)
    assertEquals(48 + 1 + 8, name.length)
  }

  @Test
  fun `a free name is kept`() {
    assertEquals("a.mp3", LibraryPaths.uniqueFileName("a.mp3", listOf("b.mp3")))
  }

  @Test
  fun `a taken stem gets the next free suffix even across extensions`() {
    assertEquals("a-2.mp3", LibraryPaths.uniqueFileName("a.mp3", listOf("a.mp3")))
    assertEquals("a-2.mp3", LibraryPaths.uniqueFileName("a.mp3", listOf("a.flac")))
    assertEquals("a-4.mp3", LibraryPaths.uniqueFileName("a.mp3", listOf("A.wav", "a-2.ogg", "a-3.mp3")))
  }

  @Test
  fun `a song folder resolves to exactly one child of songs`() {
    assertEquals(File(base.canonicalFile, "songs/abc-123"), LibraryPaths.songFolder(base, "abc-123"))
  }

  @Test
  fun `a song folder name that is not a single plain segment is rejected`() {
    for (name in listOf("", "a/b", "..", ".", ".hidden", "../songs", "/abs")) {
      assertThrows(name, UnsafeLibraryPathException::class.java) { LibraryPaths.songFolder(base, name) }
    }
  }

  @Test
  fun `a stem folder is one plain child of stems, never the import staging dir`() {
    assertEquals(File(base.canonicalFile, "stems/job123"), LibraryPaths.stemFolder(base, "job123"))
    for (name in listOf("", "a/b", "..", ".import-staging", "../songs")) {
      assertThrows(name, UnsafeLibraryPathException::class.java) { LibraryPaths.stemFolder(base, name) }
    }
  }
}
