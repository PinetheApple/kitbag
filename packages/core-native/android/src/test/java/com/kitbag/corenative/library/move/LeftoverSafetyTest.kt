package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class LeftoverSafetyTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var library: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("leftover-safety").toFile()
    fx = MoveFixture(temp)
    fx.mount(card = true, otherCard = true)
    library = fx.seedLibrary(fx.internalRoot)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun undeletableLeftover(): File =
    File(fx.cardRoot, STUCK).apply {
      mkdirs()
      File(this, "inner").writeText("x")
    }

  private fun remount() {
    fx.mount(card = false, otherCard = true)
    fx.mount(card = true, otherCard = true)
  }

  @Test
  fun `a partly failed clean-up keeps only the paths it could not delete`() {
    undeletableLeftover()
    fx.leftovers().record(CARD_UUID, listOf(SONG, STUCK))
    fx.write(fx.cardRoot, SONG, "old".toByteArray())
    assertEquals(false, fx.runner().finishLeftovers())
    assertEquals(mapOf(CARD_UUID to setOf(STUCK)), fx.leftovers().load())
    assertEquals(false, File(fx.cardRoot, SONG).exists())
  }

  @Test
  fun `a move to a card whose old copies could not be cleared is refused`() {
    undeletableLeftover()
    fx.leftovers().record(CARD_UUID, listOf(SONG, STUCK))
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_LEFTOVERS), fx.runner().start(card))
    assertEquals(DataFolderLocation.Internal, fx.location())
    assertNull(fx.runner().pending())
  }

  @Test
  fun `moving back after a partial clean-up failure keeps the moved song through a remount`() {
    val stuck = undeletableLeftover()
    fx.leftovers().record(CARD_UUID, listOf(SONG, STUCK))
    fx.runner().start(card)
    stuck.deleteRecursively()

    assertEquals(MoveOutcome.Done, fx.runner().start(card))
    remount()
    fx.runner().finishLeftovers()
    assertTrue(File(fx.cardRoot, SONG).isFile)
    assertEquals(LibraryFile.Present(File(fx.cardRoot, SONG).canonicalFile), fx.folder.resolve(SONG))
  }

  @Test
  fun `old copies are never deleted on the card in use or a pending move's target`() {
    fx.write(fx.cardRoot, SONG, "live".toByteArray())
    fx.leftovers().record(CARD_UUID, listOf(SONG))
    fx.folder.select(card)
    fx.runner().finishLeftovers()
    assertEquals("live", File(fx.cardRoot, SONG).readText())

    fx.folder.select(DataFolderLocation.Internal)
    fx.journal().save(MoveState(DataFolderLocation.Internal, card, MovePhase.COPYING, emptyList()))
    fx.runner().finishLeftovers()
    assertEquals("live", File(fx.cardRoot, SONG).readText())
  }

  @Test
  fun `undo of a paused move whose card is gone parks its copies and frees the journal`() {
    val killer = fx.runner { if (it.phase == MovePhase.VERIFYING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(card) }
    fx.mount(card = false, otherCard = true)
    fx.folder = fx.newFolder()

    val moves = fx.moves()
    assertNull(moves.undo())
    assertNull(moves.status())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))

    fx.mount(card = true, otherCard = true)
    assertTrue(fx.runner().finishLeftovers())
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.cardRoot))
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
  }

  private companion object {
    const val STUCK = "songs/zz/zz.mp3"
  }
}
