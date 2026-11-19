package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class EjectedCardCleanupTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var library: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(MoveFixture.CARD_UUID)
  private val otherCard = DataFolderLocation.Card(MoveFixture.OTHER_CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("ejected-card").toFile()
    fx = MoveFixture(temp)
    fx.mount(card = true, otherCard = true)
    fx.folder.select(card)
    library = fx.seedLibrary(fx.cardRoot)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun ejectAtCleaning(): MoveRunner =
    fx.runner { if (it.phase == MovePhase.CLEANING && it.path == null) fx.mount(card = false, otherCard = true) }

  @Test
  fun `a card ejected during clean-up parks its old copies and frees the journal`() {
    assertEquals(MoveOutcome.CleanupDeferred, ejectAtCleaning().start(DataFolderLocation.Internal))
    assertEquals(DataFolderLocation.Internal, fx.location())
    assertNull(fx.runner().pending())
    assertEquals(setOf(MoveFixture.CARD_UUID), fx.leftovers().load()!!.keys)
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
  }

  @Test
  fun `a move that does not need the ejected card proceeds while its clean-up waits`() {
    ejectAtCleaning().start(DataFolderLocation.Internal)
    assertEquals(MoveOutcome.Done, fx.runner().start(otherCard))
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.otherCardRoot))
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
  }

  @Test
  fun `a journal killed in clean-up with its card gone no longer wedges a new move`() {
    val killer = fx.runner { if (it.phase == MovePhase.CLEANING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(DataFolderLocation.Internal) }
    fx.mount(card = false, otherCard = true)
    fx.folder = fx.newFolder()

    val moves = fx.moves()
    assertNull(moves.refusalToStart(otherCard))
    assertEquals(MoveOutcome.AwaitingRelease, moves.start(otherCard))
    assertEquals(otherCard, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.otherCardRoot))
  }

  @Test
  fun `the parked clean-up finishes when the card mounts again`() {
    ejectAtCleaning().start(DataFolderLocation.Internal)
    val runner = fx.runner()
    assertFalse(runner.finishLeftovers())

    fx.mount(card = true, otherCard = true)
    assertTrue(runner.finishLeftovers())
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.cardRoot))
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
    assertEquals(emptyMap<String, Set<String>>(), fx.leftovers().load())
  }

  @Test
  fun `a move back to the returned card clears its old copies before the occupied check`() {
    ejectAtCleaning().start(DataFolderLocation.Internal)
    fx.mount(card = true, otherCard = true)
    assertEquals(MoveOutcome.Done, fx.runner().start(card))
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
  }
}
