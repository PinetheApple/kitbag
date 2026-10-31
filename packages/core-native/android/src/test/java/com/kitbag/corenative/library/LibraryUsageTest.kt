package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class LibraryUsageTest {
  @get:Rule val temp = TemporaryFolder()

  private lateinit var base: File
  private lateinit var outside: File
  private lateinit var database: File

  @Before
  fun setUp() {
    base = temp.newFolder("library")
    outside = temp.newFolder("outside")
    database = File(temp.newFolder("databases"), DB_NAME)
  }

  private fun file(path: String, size: Int): File =
    File(base, path).apply {
      parentFile.mkdirs()
      writeBytes(ByteArray(size))
    }

  private fun link(path: String, target: File) {
    File(base, path).parentFile.mkdirs()
    Files.createSymbolicLink(File(base, path).toPath(), target.toPath())
  }

  private fun measure() = LibraryUsage.measure(base, database)

  @Test
  fun `each finished import folder is one song, and its waveform is not another`() {
    file("songs/a/one.mp3", 100)
    file("songs/a/one.kwav", 10)
    file("songs/b/two.flac", 200)
    file("songs/b/deep/extra.bin", 5)

    assertEquals(LibraryAudioUsage(songs = 2, bytes = 315), measure().libraryAudio)
  }

  @Test
  fun `an import still copying is not a song yet, but its bytes count`() {
    file("songs/a/three.mp3", 0)
    file("songs/a/.three.mp3.part", 40)

    assertEquals(LibraryAudioUsage(songs = 0, bytes = 40), measure().libraryAudio)
  }

  @Test
  fun `hidden folders, empty folders and loose files under songs are not songs`() {
    file("songs/.hidden/a.mp3", 5)
    File(base, "songs/empty/sub").mkdirs()
    file("songs/loose.mp3", 6)

    assertEquals(LibraryAudioUsage(songs = 0, bytes = 11), measure().libraryAudio)
  }

  @Test
  fun `directories hold no bytes`() {
    File(base, "songs/a/b/c").mkdirs()
    File(base, "stems/set/d").mkdirs()

    val usage = measure()
    assertEquals(LibraryAudioUsage(songs = 0, bytes = 0), usage.libraryAudio)
    assertEquals(StemSetUsage(count = 1, bytes = 0), usage.stemSets)
  }

  @Test
  fun `symlinks are neither followed nor counted`() {
    File(outside, "big.wav").writeBytes(ByteArray(5000))
    File(outside, "dir").mkdirs()
    File(outside, "dir/inner.wav").writeBytes(ByteArray(7000))
    file("songs/a/real.mp3", 50)
    link("songs/a/linked.wav", File(outside, "big.wav"))
    link("songs/b/only-link.wav", File(outside, "big.wav"))
    link("songs/linkdir", File(outside, "dir"))
    link("stems/linkset", File(outside, "dir"))
    link("songs/a/dangling.wav", File(outside, "absent.wav"))

    val usage = measure()
    assertEquals(LibraryAudioUsage(songs = 1, bytes = 50), usage.libraryAudio)
    assertEquals(StemSetUsage(count = 0, bytes = 0), usage.stemSets)
  }

  @Test
  fun `a symlinked library root is measured as the directory it names`() {
    val real = temp.newFolder("real-library")
    File(real, "songs/a").mkdirs()
    File(real, "songs/a/x.mp3").writeBytes(ByteArray(30))
    val linkedBase = File(temp.root, "linked-library")
    Files.createSymbolicLink(linkedBase.toPath(), real.toPath())

    assertEquals(LibraryAudioUsage(songs = 1, bytes = 30), LibraryUsage.measure(linkedBase, database).libraryAudio)
  }

  @Test
  fun `stem sets are the visible folders under stems, and their side files count in their bytes`() {
    file("stems/job1/vocals.flac", 300)
    file("stems/job1/vocals.kwav", 3)
    file("stems/job2/drums.flac", 400)
    File(base, "stems/job3").mkdirs()
    file("stems/${StemBundleImporter.STAGING_DIR_NAME}/half.flac", 20)
    file("stems/stray.flac", 7)

    val usage = measure()
    assertEquals(StemSetUsage(count = 3, bytes = 730), usage.stemSets)
    assertEquals(LibraryAudioUsage(songs = 0, bytes = 0), usage.libraryAudio)
  }

  @Test
  fun `files outside songs and stems count in library audio bytes`() {
    file(".analysis-results/a.json", 12)
    file(".analysis-staging/b.kwav", 8)
    file("loose.mp3", 5)

    assertEquals(LibraryAudioUsage(songs = 0, bytes = 25), measure().libraryAudio)
  }

  @Test
  fun `a missing library root measures as empty`() {
    base.deleteRecursively()

    val usage = measure()
    assertEquals(LibraryAudioUsage(songs = 0, bytes = 0), usage.libraryAudio)
    assertEquals(StemSetUsage(count = 0, bytes = 0), usage.stemSets)
  }

  @Test
  fun `the database counts its file plus its sqlite side files and nothing else`() {
    database.writeBytes(ByteArray(1000))
    File(database.parentFile, "$DB_NAME-wal").writeBytes(ByteArray(200))
    File(database.parentFile, "$DB_NAME-shm").writeBytes(ByteArray(30))
    File(database.parentFile, "$DB_NAME-journal").writeBytes(ByteArray(4))
    File(database.parentFile, "other.db").writeBytes(ByteArray(9999))
    File(database.parentFile, "$DB_NAME-other").writeBytes(ByteArray(9999))

    assertEquals(1234L, measure().databaseBytes)
  }

  @Test
  fun `an unopened database measures zero`() {
    assertEquals(0L, measure().databaseBytes)
  }

  @Test
  fun `missing reports absent paths and directories, keeps present files even when empty, in input order`() {
    file("songs/a/present.mp3", 1)
    file("songs/a/zero.mp3", 0)
    File(base, "songs/dir.mp3").mkdirs()

    val missing = LibraryUsage.missing(
      base,
      sequenceOf("songs/absent.mp3", "songs/a/present.mp3", "songs/dir.mp3", "songs/a/zero.mp3"),
    ).toList()

    assertEquals(listOf("songs/absent.mp3", "songs/dir.mp3"), missing)
  }

  @Test
  fun `a path that escapes the library counts as missing even when the file exists`() {
    File(outside, "real.mp3").writeBytes(ByteArray(1))
    link("songs/out", outside)
    val escapes = listOf("../outside/real.mp3", "songs/../../outside/real.mp3", "/etc/hosts", "songs/out/real.mp3", "")

    assertEquals(escapes, LibraryUsage.missing(base, escapes.asSequence()).toList())
  }

  @Test
  fun `missing pulls paths only as the caller consumes results`() {
    var pulled = 0
    val paths = generateSequence(0) { it + 1 }
      .take(LARGE_INPUT)
      .map { pulled++; "songs/absent-$it.mp3" }

    val missing = LibraryUsage.missing(base, paths)
    assertEquals(0, pulled)
    assertEquals("songs/absent-0.mp3", missing.first())
    assertEquals(1, pulled)
  }

  @Test
  fun `missing handles a large list in one pass`() {
    for (i in 0 until LARGE_INPUT step 2) file("songs/s/$i.mp3", 0)
    val paths = (0 until LARGE_INPUT).asSequence().map { "songs/s/$it.mp3" }

    val missing = LibraryUsage.missing(base, paths).toList()
    assertEquals(LARGE_INPUT / 2, missing.size)
    assertEquals("songs/s/1.mp3", missing.first())
    assertEquals("songs/s/${LARGE_INPUT - 1}.mp3", missing.last())
  }

  private companion object {
    const val DB_NAME = "kitbag"
    const val LARGE_INPUT = 10_000
  }
}
