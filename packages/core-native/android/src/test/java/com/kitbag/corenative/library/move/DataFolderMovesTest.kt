package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
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

class DataFolderMovesTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var library: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(MoveFixture.CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("data-folder-moves").toFile()
    fx = MoveFixture(temp)
    library = fx.seedLibrary(fx.internalRoot)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun oldCopiesKept() = assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))

  @Test
  fun `a switch made in this process keeps the old copies until the players release them`() {
    val moves = fx.moves()
    assertEquals(MoveOutcome.AwaitingRelease, moves.start(card))
    assertEquals(card, fx.location())
    oldCopiesKept()
    assertTrue(moves.status()!!.awaitingRelease)

    assertTrue(moves.releaseOldCopies())
    assertEquals(MoveOutcome.Done, moves.resume())
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.internalRoot))
    assertNull(moves.status())
  }

  @Test
  fun `released players still wait out a running mixdown before any old copy goes`() {
    var mixdownPolls = 0
    val moves = fx.moves(
      mixdownRunning = { mixdownPolls < MIXDOWN_POLLS },
      pause = {
        oldCopiesKept()
        mixdownPolls++
      },
    )
    assertEquals(MoveOutcome.AwaitingRelease, moves.start(card))
    moves.releaseOldCopies()
    assertEquals(MoveOutcome.Done, moves.resume())
    assertEquals(MIXDOWN_POLLS, mixdownPolls)
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.internalRoot))
  }

  @Test
  fun `a release before the switch does not let that switch skip the players`() {
    val moves = fx.moves()
    assertFalse(moves.releaseOldCopies())
    assertEquals(MoveOutcome.AwaitingRelease, moves.start(card))
    oldCopiesKept()
  }

  @Test
  fun `the next launch counts as released`() {
    assertEquals(MoveOutcome.AwaitingRelease, fx.moves().start(card))
    fx.folder = fx.newFolder()
    assertEquals(MoveOutcome.Done, fx.moves().resume())
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.internalRoot))
  }

  @Test
  fun `refusals name why the request cannot run`() {
    val moves = fx.moves()
    assertEquals(MoveRefusal.SAME_LOCATION, moves.refusalToStart(DataFolderLocation.Internal))
    assertEquals(MoveRefusal.NO_MOVE, moves.refusalToResume())
    assertEquals(MoveRefusal.NO_MOVE, moves.cancel())

    assertEquals(MoveOutcome.AwaitingRelease, moves.start(card))
    assertEquals(MoveRefusal.SWITCHED, moves.undo())
    assertEquals(MoveRefusal.IN_PROGRESS, moves.refusalToStart(DataFolderLocation.Internal))
    assertEquals(MoveOutcome.Refused(MoveRefusal.IN_PROGRESS), moves.start(DataFolderLocation.Internal))
  }

  @Test
  fun `a paused move reports itself paused with its file counts, and undo discards it`() {
    val killer = fx.runner { if (it.phase == MovePhase.VERIFYING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(card) }
    fx.folder = fx.newFolder()
    val moves = fx.moves()
    val status = moves.status()!!
    assertTrue(status.paused)
    assertFalse(status.awaitingRelease)
    assertEquals(library.size, status.progress.totalFiles)

    assertNull(moves.undo())
    assertNull(moves.status())
    assertFalse(File(fx.cardRoot, SONG).exists())
    oldCopiesKept()
  }

  @Test
  fun `use internal storage inside an import refuses instead of deadlocking`() {
    fx.folder.importing {
      assertThrows(IllegalStateException::class.java) { fx.moves().useInternalStorage(listOf(SONG)) }
    }
  }

  private companion object {
    const val MIXDOWN_POLLS = 3
  }
}
