package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.IMPORTED
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import com.kitbag.corenative.library.move.MoveFixture.Companion.WAVEFORM
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

class CardReturnTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var away: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("card-return").toFile()
    fx = MoveFixture(temp)
    fx.folder.select(card)
    away = fx.seedLibrary(fx.cardRoot)
    fx.write(fx.cardRoot, NOT_AWAY, "not listed".toByteArray())
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    assertNull(fx.runner().useInternalStorage(away.keys))
    fx.write(fx.internalRoot, IMPORTED, "imported here".toByteArray())
    fx.volumes.volumes = listOf(fx.card(mounted = true))
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun onInternal(): Map<String, String> = fx.visibleFiles(fx.internalRoot) - IMPORTED

  private fun awayList() = AwayManifest(File(fx.filesDir, AwayManifest.FILE_NAME), { _, _ -> }).load()

  private fun stagedFiles() =
    fx.internalRoot.walkTopDown().filter { it.isFile && it.path.contains(STAGING_SEGMENT) }.toList()

  private fun assertReturned() {
    assertEquals(DataFolderLocation.Internal, fx.location())
    assertEquals(fx.hashes(away), onInternal())
    assertEquals(setOf(NOT_AWAY), fx.visibleFiles(fx.cardRoot).keys)
    assertEquals(emptyMap<String, Set<String>>(), awayList())
    assertEquals(emptyList<File>(), stagedFiles())
    assertFalse(fx.journalFile.exists())
  }

  private fun assertCardUntouched() {
    assertEquals(DataFolderLocation.Internal, fx.location())
    assertEquals(fx.hashes(away).keys + NOT_AWAY, fx.visibleFiles(fx.cardRoot).keys)
    assertEquals(emptyMap<String, String>(), onInternal())
    assertEquals(mapOf(CARD_UUID to away.keys), awayList())
  }

  @Test
  fun `a returned card's away songs and their waveforms move to internal storage`() {
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertReturned()
    assertEquals(LibraryFile.Present(File(fx.internalRoot, WAVEFORM).canonicalFile), fx.folder.resolve(WAVEFORM))
  }

  @Test
  fun `an away song plays from the card until its copy is verified and switched`() {
    val seen = mutableListOf<LibraryFile>()
    fx.runner { if (it.phase <= MovePhase.CATCH_UP) seen.add(fx.folder.resolve(SONG)) }.returnCard(card)
    assertTrue(seen.isNotEmpty())
    assertTrue(seen.all { it == LibraryFile.Present(File(fx.cardRoot, SONG).canonicalFile) })
  }

  @Test
  fun `a kill at any phase resumes to the same result`() {
    for (phase in MovePhase.values()) {
      val killer = fx.runner { if (it.phase == phase && it.path == null) throw MoveFixture.Killed() }
      assertThrows(phase.name, MoveFixture.Killed::class.java) { killer.returnCard(card) }
      assertEquals(phase.name, phase, fx.newProcess().pending()?.phase)
      assertEquals(phase.name, MoveOutcome.Done, fx.newProcess().resume())
      assertReturned()
      tearDown()
      setUp()
    }
  }

  @Test
  fun `a kill halfway through the switch resumes without losing a song`() {
    var renames = 0
    val killer = fx.runner {
      if (it.phase == MovePhase.SWITCHED && it.path != null && ++renames == 2) throw MoveFixture.Killed()
    }
    assertThrows(MoveFixture.Killed::class.java) { killer.returnCard(card) }
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertReturned()
  }

  @Test
  fun `cancel before the switch leaves the card untouched`() {
    lateinit var runner: MoveRunner
    runner = fx.runner { if (it.phase == MovePhase.COPYING && it.path != null) runner.cancel() }
    assertEquals(MoveOutcome.Cancelled, runner.returnCard(card))
    assertCardUntouched()
    assertEquals(emptyList<File>(), stagedFiles())
    assertNull(fx.runner().pending())
  }

  @Test
  fun `undo of a paused return leaves the card untouched`() {
    val killer = fx.runner { if (it.phase == MovePhase.VERIFYING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.returnCard(card) }
    assertTrue(fx.newProcess().cancel())
    assertCardUntouched()
    assertEquals(emptyList<File>(), stagedFiles())
  }

  @Test
  fun `cancel is refused once the switch began`() {
    val killer = fx.runner { if (it.phase == MovePhase.SWITCHED && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.returnCard(card) }
    assertFalse(fx.newProcess().cancel())
  }

  @Test
  fun `a card ejected mid-copy pauses the move instead of dropping its songs`() {
    val hidden = File(temp, "ejected")
    var copied = 0
    val ejecting = fx.runner {
      if (it.phase == MovePhase.COPYING && it.path != null && ++copied == 1) {
        fx.volumes.volumes = listOf(fx.card(mounted = false))
        assertTrue(fx.cardFilesDir.renameTo(hidden))
      }
    }
    assertEquals(MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE), ejecting.returnCard(card))
    assertEquals(away.keys, fx.runner().pending()?.files?.map { it.path }?.toSet())
    assertEquals(mapOf(CARD_UUID to away.keys), awayList())

    assertTrue(hidden.renameTo(fx.cardFilesDir))
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertReturned()
  }

  @Test
  fun `the card keeps its copies until the old copies are released`() {
    fx.released = false
    assertEquals(MoveOutcome.AwaitingRelease, fx.runner().returnCard(card))
    assertEquals(fx.hashes(away), onInternal())
    assertEquals(fx.hashes(away).keys + NOT_AWAY, fx.visibleFiles(fx.cardRoot).keys)
    assertEquals(emptyMap<String, Set<String>>(), awayList())

    fx.released = true
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertReturned()
  }

  @Test
  fun `a card ejected before clean-up keeps its old copies parked for its return`() {
    val ejecting = fx.runner {
      if (it.phase == MovePhase.CLEANING && it.path == null) fx.volumes.volumes = listOf(fx.card(mounted = false))
    }
    assertEquals(MoveOutcome.CleanupDeferred, ejecting.returnCard(card))
    assertEquals(fx.hashes(away), onInternal())
    assertEquals(mapOf(CARD_UUID to away.keys), fx.leftovers().load())

    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertTrue(fx.runner().finishLeftovers())
    assertReturned()
  }

  @Test
  fun `a song already on internal storage blocks the return before anything is copied`() {
    fx.write(fx.internalRoot, SONG, "clash".toByteArray())
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_OCCUPIED), fx.runner().returnCard(card))
    assertEquals(mapOf(CARD_UUID to away.keys), awayList())
    assertNull(fx.runner().pending())
  }

  @Test
  fun `a card holding nothing away has nothing to return`() {
    fx.runner().returnCard(card)
    assertEquals(MoveOutcome.NoMove, fx.runner().returnCard(card))
  }

  @Test
  fun `the mounted card reports its away files and their size`() {
    val files = fx.folder.awayOnCard(CARD_UUID)
    assertEquals(away.keys.size, files.size)
    assertEquals(away.values.sumOf { it.size.toLong() }, files.sumOf { it.length() })
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    assertEquals(emptyList<File>(), fx.folder.awayOnCard(CARD_UUID))
  }

  @Test
  fun `a return is refused while another move is pending, and onto the card in use`() {
    fx.journal().save(MoveState(DataFolderLocation.Internal, card, MovePhase.COPYING, emptyList()))
    val moves = fx.moves()
    assertEquals(MoveRefusal.IN_PROGRESS, moves.refusalToStart(card))
    fx.journalFile.delete()
    assertNull(moves.refusalToStart(card))
    fx.folder.select(card)
    assertEquals(MoveRefusal.SAME_LOCATION, moves.refusalToStart(card))
  }

  companion object {
    private const val NOT_AWAY = "songs/z/z.mp3"
    private const val STAGING_SEGMENT = "/.card-return/"
  }
}
