package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
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

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("data-folder").toFile()
    filesDir = File(temp, "files").apply { mkdirs() }
    cardFilesDir = File(temp, "card").apply { mkdirs() }
    volumes = FakeVolumes(listOf(card(mounted = true)))
    folder = DataFolder(filesDir, volumes)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun card(mounted: Boolean) = PortableVolume(CARD_UUID, cardFilesDir, mounted, freeBytes = 0L)

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
  fun `an absolute path is refused whether or not the card is mounted`() {
    assertThrows(UnsafeLibraryPathException::class.java) { folder.resolve("/etc/passwd") }
    folder.select(DataFolderLocation.Card(CARD_UUID))
    volumes.volumes = emptyList()
    assertThrows(UnsafeLibraryPathException::class.java) { folder.resolve("/etc/passwd") }
    assertThrows(UnsafeLibraryPathException::class.java) { folder.resolve("../x") }
  }

  @Test
  fun `a corrupt state file means internal`() {
    File(filesDir, DataFolder.STATE_FILE_NAME).writeText("{not json")
    assertEquals(DataFolderLocation.Internal, folder.location())
    assertEquals(internalRoot(), folder.root())
  }

  @Test
  fun `selecting internal again returns to the internal root`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    folder.select(DataFolderLocation.Internal)
    assertEquals(internalRoot(), folder.root())
  }

  @Test
  fun `analysis staging and results stay pinned under filesDir whatever the root`() {
    folder.select(DataFolderLocation.Card(CARD_UUID))
    assertEquals(cardRoot(), folder.root())
    assertEquals(internalRoot(), LibraryStorage.staging(folder).parentFile)
    assertEquals(internalRoot(), LibraryStorage.resultsDir(folder).parentFile)
  }

  @Test
  fun `a backup-restored relative row resolves under a card root`() {
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
