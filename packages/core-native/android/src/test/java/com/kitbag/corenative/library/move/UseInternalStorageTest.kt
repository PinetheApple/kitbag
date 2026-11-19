package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryAvailability
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.LibraryUsage
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.IMPORTED
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class UseInternalStorageTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("use-internal").toFile()
    fx = MoveFixture(temp)
    fx.folder.select(DataFolderLocation.Card(CARD_UUID))
    fx.write(fx.cardRoot, SONG, "on the card".toByteArray())
    fx.volumes.volumes = listOf(fx.card(mounted = false))
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  @Test
  fun `songs left on a missing card stay unavailable under internal storage`() {
    assertTrue(fx.runner().useInternalStorage(listOf(SONG)))
    assertEquals(DataFolderLocation.Internal, fx.location())
    assertEquals(LibraryFile.Unavailable(CARD_UUID), fx.folder.resolve(SONG))
    assertEquals(LibraryFile.Missing, fx.folder.resolve(IMPORTED))

    val availability = LibraryUsage.availability(fx.folder.rootState(), sequenceOf(SONG, IMPORTED))
    assertEquals(LibraryAvailability(listOf(IMPORTED), listOf(SONG), rootAvailable = true), availability)
  }

  @Test
  fun `an away song plays from its card once the card returns`() {
    fx.runner().useInternalStorage(listOf(SONG))
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertEquals(LibraryFile.Present(File(fx.cardRoot, SONG).canonicalFile), fx.folder.resolve(SONG))
  }

  @Test
  fun `new imports land in internal storage after the switch`() {
    fx.runner().useInternalStorage(listOf(SONG))
    val imported = fx.write(fx.internalRoot, IMPORTED, "new".toByteArray())
    assertEquals(LibraryFile.Present(imported.canonicalFile), fx.folder.resolve(IMPORTED))
  }

  @Test
  fun `a mounted card is not abandoned`() {
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertFalse(fx.runner().useInternalStorage(listOf(SONG)))
    assertEquals(DataFolderLocation.Card(CARD_UUID), fx.location())
  }

  @Test
  fun `an unreadable away list makes absent songs unknown, never missing`() {
    fx.runner().useInternalStorage(listOf(SONG))
    File(fx.filesDir, AwayManifest.FILE_NAME).writeText("{not json")
    assertEquals(LibraryFile.Unknown, fx.folder.resolve(SONG))
    assertEquals(1, fx.warnings.size)
  }
}
