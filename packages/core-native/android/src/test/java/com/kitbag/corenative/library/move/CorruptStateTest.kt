package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryErrors
import com.kitbag.corenative.library.UnreadableStateException
import com.kitbag.corenative.library.UnsafeLibraryPathException
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.OTHER_CARD_UUID
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

class CorruptStateTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var library: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(CARD_UUID)
  private val otherCard = DataFolderLocation.Card(OTHER_CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("corrupt-state").toFile()
    fx = MoveFixture(temp)
    fx.mount(card = true, otherCard = true)
    library = fx.seedLibrary(fx.internalRoot)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private val leftoversFile get() = File(fx.filesDir, DataFolderMoves.LEFTOVERS_FILE_NAME)

  private fun corruptLeftovers() = leftoversFile.writeText(CORRUPT)

  @Test
  fun `an unreadable leftovers file is set aside and moves to either card proceed`() {
    corruptLeftovers()
    val theirs = fx.write(fx.otherCardRoot, UNRELATED, "theirs".toByteArray())
    assertEquals(MoveOutcome.Done, fx.runner().start(card))
    assertEquals(MoveOutcome.Done, fx.runner().start(otherCard))

    assertEquals(otherCard, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.otherCardRoot) - UNRELATED)
    assertEquals("theirs", theirs.readText())
    assertEquals(CORRUPT, File(fx.filesDir, DataFolderMoves.LEFTOVERS_FILE_NAME + ".corrupt").readText())
    assertEquals(1, fx.warnings.size)
  }

  @Test
  fun `undo with the card gone still parks its copies when the leftovers file was unreadable`() {
    val killer = fx.runner { if (it.phase == MovePhase.VERIFYING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(card) }
    corruptLeftovers()
    fx.mount(card = false, otherCard = true)
    fx.folder = fx.newFolder()

    assertNull(fx.moves().undo())
    assertNull(fx.runner().pending())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
    assertEquals(library.keys, fx.leftovers().load()!!.getValue(CARD_UUID))
  }

  @Test
  fun `a leftovers file that cannot be written fails the move as i-o instead of throwing`() {
    fx.internalRoot.deleteRecursively()
    fx.folder.select(card)
    fx.seedLibrary(fx.cardRoot)
    val killer = fx.runner { if (it.phase == MovePhase.CLEANING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(DataFolderLocation.Internal) }
    fx.mount(card = false, otherCard = true)
    fx.folder = fx.newFolder()
    File(leftoversFile, "blocker").apply { parentFile.mkdirs() }.writeText("x")

    val events = mutableListOf<MoveEvent>()
    val moves = fx.moves()
    moves.watch { events.add(it) }
    assertEquals(MoveOutcome.Failed(MoveFailure.IO), moves.start(otherCard))
    assertEquals(listOf(MoveEvent.Finished(MoveOutcome.Failed(MoveFailure.IO))), events.filterIsInstance<MoveEvent.Finished>())
  }

  @Test
  fun `an unreadable away list is its own error, and a bad path stays i-o`() {
    fx.folder.select(card)
    fx.mount(card = false, otherCard = true)
    File(fx.filesDir, AwayManifest.FILE_NAME).writeText(CORRUPT)

    val error = assertThrows(UnreadableStateException::class.java) { fx.moves().useInternalStorage(listOf(SONG)) }
    assertEquals(LibraryErrors.moveCode(MoveFailure.STATE_UNREADABLE), MoveReport.codeFor(error))
    assertEquals("E_MOVE_STATE_UNREADABLE", MoveReport.codeFor(RuntimeException(error)))
    assertEquals(LibraryErrors.moveCode(MoveFailure.IO), MoveReport.codeFor(UnsafeLibraryPathException("../x")))
    assertEquals(card, fx.location())
    assertTrue(File(fx.filesDir, AwayManifest.FILE_NAME).isFile)
  }

  private companion object {
    const val CORRUPT = "{not json"
    const val UNRELATED = "songs/theirs/theirs.mp3"
  }
}
