package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryAvailability
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.LibraryUsage
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.DRUMS
import com.kitbag.corenative.library.move.MoveFixture.Companion.IMPORTED
import com.kitbag.corenative.library.move.MoveFixture.Companion.OTHER_CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
    assertNull(fx.runner().useInternalStorage(listOf(SONG)))
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
  fun `a file under internal storage resolves there while the card is away`() {
    fx.runner().useInternalStorage(listOf(SONG))
    val imported = fx.write(fx.internalRoot, IMPORTED, "new".toByteArray())
    assertEquals(LibraryFile.Present(imported.canonicalFile), fx.folder.resolve(IMPORTED))
  }

  @Test
  fun `a mounted card is not abandoned`() {
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertEquals(MoveRefusal.CARD_MOUNTED, fx.runner().useInternalStorage(listOf(SONG)))
    assertEquals(DataFolderLocation.Card(CARD_UUID), fx.location())
  }

  @Test
  fun `internal storage refuses again, and a pending move refuses, each with its own reason`() {
    fx.runner().useInternalStorage(listOf(SONG))
    assertEquals(MoveRefusal.NOT_ON_CARD, fx.runner().useInternalStorage(listOf(SONG)))
    fx.folder.select(DataFolderLocation.Card(CARD_UUID))
    fx.journal().save(MoveState(DataFolderLocation.Card(CARD_UUID), DataFolderLocation.Internal, MovePhase.COPYING, emptyList()))
    assertEquals(MoveRefusal.IN_PROGRESS, fx.runner().useInternalStorage(listOf(SONG)))
  }

  @Test
  fun `a path belongs to one card, so one away elsewhere or on internal storage is not recorded`() {
    fx.folder.leaveAway(OTHER_CARD_UUID, listOf(DRUMS))
    fx.write(fx.internalRoot, IMPORTED, "here".toByteArray())
    fx.runner().useInternalStorage(listOf(SONG, DRUMS, IMPORTED))
    assertEquals(mapOf(OTHER_CARD_UUID to setOf(DRUMS), CARD_UUID to setOf(SONG)), awayList())
  }

  @Test
  fun `a path recorded on two cards stays unavailable while either is missing`() {
    fx.mount(card = false, otherCard = true)
    fx.folder.leaveAway(OTHER_CARD_UUID, listOf("songs/o/o.mp3"))
    fx.folder.leaveAway(CARD_UUID, listOf(SONG))
    fx.folder.leaveAway(OTHER_CARD_UUID, listOf(SONG))
    fx.folder.select(DataFolderLocation.Internal)
    assertEquals(LibraryFile.Unavailable(CARD_UUID), fx.folder.resolve(SONG))
  }

  @Test
  fun `a path on two cards plays from whichever mounted card holds it`() {
    fx.mount(card = true, otherCard = true)
    fx.folder.leaveAway(OTHER_CARD_UUID, listOf(SONG))
    fx.folder.leaveAway(CARD_UUID, listOf(SONG))
    fx.folder.select(DataFolderLocation.Internal)
    assertEquals(LibraryFile.Present(File(fx.cardRoot, SONG).canonicalFile), fx.folder.resolve(SONG))
  }

  @Test
  fun `a move that takes a card's files forgets that card's away list`() {
    fx.runner().useInternalStorage(listOf(SONG))
    fx.mount(card = true, otherCard = true)
    fx.folder.leaveAway(OTHER_CARD_UUID, listOf(DRUMS))
    fx.write(fx.internalRoot, IMPORTED, "new".toByteArray())
    File(fx.cardRoot, SONG).delete()
    assertEquals(MoveOutcome.Done, fx.runner().start(DataFolderLocation.Card(CARD_UUID)))
    assertEquals(mapOf(OTHER_CARD_UUID to setOf(DRUMS)), awayList())
  }

  private fun awayList() = AwayManifest(File(fx.filesDir, AwayManifest.FILE_NAME), { _, _ -> }).load()

  @Test
  fun `an unreadable away list makes absent songs unknown, never missing`() {
    fx.runner().useInternalStorage(listOf(SONG))
    File(fx.filesDir, AwayManifest.FILE_NAME).writeText("{not json")
    assertEquals(LibraryFile.Unknown, fx.folder.resolve(SONG))
    assertEquals(1, fx.warnings.size)
  }
}
