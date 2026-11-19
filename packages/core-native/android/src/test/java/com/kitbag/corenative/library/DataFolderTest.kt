package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Before
import org.junit.Test

class DataFolderTest {
  private class FakeVolumes(var volumes: List<PortableVolume>) : VolumeProvider {
    override fun portable() = volumes
  }

  private lateinit var temp: File
  private lateinit var filesDir: File
  private lateinit var cardFilesDir: File
  private lateinit var volumes: FakeVolumes
  private lateinit var folder: DataFolder
  private val warnings = mutableListOf<String>()

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("data-folder").toFile()
    filesDir = File(temp, "files").apply { mkdirs() }
    cardFilesDir = File(temp, "card").apply { mkdirs() }
    volumes = FakeVolumes(listOf(card(mounted = true)))
    folder = DataFolder(filesDir, volumes) { message, _ -> warnings.add(message) }
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun card(mounted: Boolean) = PortableVolume(CARD_UUID, cardFilesDir, mounted)

  private fun internalRoot() = File(filesDir, DataFolder.DIR_NAME)

  private fun cardRoot() = File(cardFilesDir, DataFolder.DIR_NAME)

  private fun createUnder(root: File, relativePath: String) =
    File(root, relativePath).apply {
      parentFile.mkdirs()
      writeText("audio")
    }

  @Test
  fun `no state file means the internal root`() {
    assertEquals(DataFolderLocation.Internal, folder.location())
    assertEquals(internalRoot(), folder.root())
  }

  @Test
  fun `a mounted card makes the card root`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    assertEquals(cardRoot(), folder.root())
  }

  @Test
  fun `a file under the card root is present`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    val song = createUnder(cardRoot(), SONG)
    assertEquals(LibraryFile.Present(song.canonicalFile), folder.resolve(SONG))
  }

  @Test
  fun `a file absent under the root is missing`() {
    assertEquals(LibraryFile.Missing, folder.resolve(SONG))
  }

  @Test
  fun `an unmounted card leaves its paths unavailable`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    volumes.volumes = listOf(card(mounted = false))
    assertEquals(LibraryFile.Unavailable(CARD_UUID), folder.resolve(SONG))
    assertThrows(DataFolderUnavailableException::class.java) { folder.root() }
  }

  @Test
  fun `a card that is no longer listed leaves its paths unavailable`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    volumes.volumes = emptyList()
    assertEquals(LibraryFile.Unavailable(CARD_UUID), folder.resolve(SONG))
  }

  @Test
  fun `absolute and parent-escaping paths are refused whatever the location`() {
    assertThrows(UnsafeLibraryPathException::class.java) { folder.resolve("/etc/passwd") }
    folder.select(DataFolderLocation.Card(CARD_UUID))
    volumes.volumes = emptyList()
    assertThrows(UnsafeLibraryPathException::class.java) { folder.resolve("/etc/passwd") }
    assertThrows(UnsafeLibraryPathException::class.java) { folder.resolve("../x") }
  }

  @Test
  fun `a malformed state file means internal and is logged once`() {
    val stateFile = File(filesDir, DataFolder.STATE_FILE_NAME)
    for (contents in listOf("{not json", "", "[]", "\"card\"", "{\"kind\":\"card\"}", "{\"kind\":\"tape\"}")) {
      stateFile.writeText(contents)
      assertEquals(contents, DataFolderLocation.Internal, folder.location())
      assertEquals(contents, internalRoot(), folder.root())
      assertEquals(contents, RootState.Mounted(internalRoot(), known = false), folder.rootState())
    }
    assertEquals(1, warnings.size)
  }

  @Test
  fun `a state file that cannot be read means internal and is logged`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    val stateFile = File(filesDir, DataFolder.STATE_FILE_NAME).apply { setReadable(false) }
    assumeFalse("running as root, the file stays readable", stateFile.canRead())
    assertEquals(DataFolderLocation.Internal, folder.location())
    assertEquals(RootState.Mounted(internalRoot(), known = false), folder.rootState())
    assertTrue(warnings.isNotEmpty())
  }

  @Test
  fun `a malformed state file never makes a card song missing`() {
    File(filesDir, DataFolder.STATE_FILE_NAME).writeText("{not json")
    assertEquals(LibraryFile.Unknown, folder.resolve(SONG))

    val availability = LibraryUsage.availability(folder.rootState(), sequenceOf(SONG))
    assertEquals(LibraryAvailability(emptyList(), listOf(SONG), rootAvailable = false), availability)
  }

  @Test
  fun `missing splits absent files from files on an unmounted card`() {
    createUnder(internalRoot(), SONG)
    val internal = LibraryUsage.availability(folder.rootState(), sequenceOf(SONG, RESTORED_SONG))
    assertEquals(LibraryAvailability(listOf(RESTORED_SONG), emptyList(), rootAvailable = true), internal)

    folder.select(DataFolderLocation.Card(CARD_UUID))
    volumes.volumes = listOf(card(mounted = false))
    val away = LibraryUsage.availability(folder.rootState(), sequenceOf(SONG, RESTORED_SONG))
    assertEquals(LibraryAvailability(emptyList(), listOf(SONG, RESTORED_SONG), rootAvailable = false), away)
  }

  @Test
  fun `a mounted card reports only its absent files missing`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    createUnder(cardRoot(), SONG)
    val availability = LibraryUsage.availability(folder.rootState(), sequenceOf(SONG, RESTORED_SONG))
    assertEquals(LibraryAvailability(listOf(RESTORED_SONG), emptyList(), rootAvailable = true), availability)
  }

  @Test
  fun `selecting internal again returns to the internal root`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    folder.select(DataFolderLocation.Internal)
    assertEquals(internalRoot(), folder.root())
  }

  @Test
  fun `analysis staging and results stay pinned under the internal root`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    assertEquals(cardRoot(), folder.root())
    assertEquals(internalRoot(), LibraryStorage.staging(folder).parentFile)
    assertEquals(internalRoot(), LibraryStorage.resultsDir(folder).parentFile)
  }

  @Test
  fun `a path present under both roots resolves to the card copy`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    val song = createUnder(cardRoot(), RESTORED_SONG)
    createUnder(internalRoot(), RESTORED_SONG)
    assertEquals(LibraryFile.Present(song.canonicalFile), folder.resolve(RESTORED_SONG))
  }

  private companion object {
    const val CARD_UUID = "1234-ABCD"
    const val SONG = "songs/a/a.mp3"
    const val RESTORED_SONG = "songs/w/waltz.mp3"
  }
}
