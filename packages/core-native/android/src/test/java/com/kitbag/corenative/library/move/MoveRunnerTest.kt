package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.move.MoveFixture.Companion.BASS
import com.kitbag.corenative.library.move.MoveFixture.Companion.DRUMS
import com.kitbag.corenative.library.move.MoveFixture.Companion.EXCLUDED
import com.kitbag.corenative.library.move.MoveFixture.Companion.IMPORTED
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import com.kitbag.corenative.library.move.MoveFixture.Companion.WAVEFORM
import java.io.File
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MoveRunnerTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var library: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(MoveFixture.CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("move-runner").toFile()
    fx = MoveFixture(temp)
    library = fx.seedLibrary(fx.internalRoot)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun assertMovedToCard() {
    assertEquals(card, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.internalRoot))
    EXCLUDED.forEach { assertTrue(it, File(fx.internalRoot, it).isFile) }
    assertFalse(fx.journalFile.exists())
  }

  private fun assertSourceUntouched() {
    assertEquals(DataFolderLocation.Internal, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
    EXCLUDED.forEach { assertTrue(it, File(fx.internalRoot, it).isFile) }
  }

  private fun cardHasNoFiles() = fx.cardRoot.walkTopDown().none { it.isFile }

  @Test
  fun `a move runs every phase in order and ends on the card`() {
    val phases = mutableListOf<MovePhase>()
    val outcome = fx.runner { if (it.path == null) phases.add(it.phase) }.start(card)
    assertEquals(MoveOutcome.Done, outcome)
    assertEquals(MovePhase.values().toList(), phases)
    assertMovedToCard()
  }

  @Test
  fun `a kill at any phase resumes to the same result`() {
    for (phase in MovePhase.values()) {
      val killer = fx.runner { if (it.phase == phase && it.path == null) throw MoveFixture.Killed() }
      assertThrows(phase.name, MoveFixture.Killed::class.java) { killer.start(card) }
      assertEquals(phase.name, phase, fx.newProcess().pending()?.phase)
      assertEquals(phase.name, MoveOutcome.Done, fx.newProcess().resume())
      assertMovedToCard()
      tearDown()
      setUp()
    }
  }

  @Test
  fun `a kill between two copies resumes without recopying the first`() {
    var copied = 0
    val killer = fx.runner { if (it.phase == MovePhase.COPYING && it.path != null && ++copied == 2) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(card) }
    assertEquals(2, fx.newProcess().pending()?.files?.count { it.copied })
    val torn = fx.write(fx.cardRoot, "stems/job1/.drums.wav.part", "torn".toByteArray())
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertMovedToCard()
    assertFalse(torn.exists())
  }

  @Test
  fun `a copy that does not match its source stops the move before the switch`() {
    val runner = fx.runner {
      if (it.phase == MovePhase.VERIFYING && it.path == null) fx.write(fx.cardRoot, DRUMS, "corrupt".toByteArray())
    }
    assertEquals(MoveOutcome.Failed(MoveFailure.HASH_MISMATCH, DRUMS), runner.start(card))
    assertSourceUntouched()
    val paused = fx.newProcess().pending()!!
    assertEquals(MovePhase.COPYING, paused.phase)
    assertEquals(MoveFailure.HASH_MISMATCH, paused.failure)

    assertTrue(fx.newProcess().cancel())
    assertSourceUntouched()
    assertTrue(cardHasNoFiles())
    assertNull(fx.newProcess().pending())
  }

  @Test
  fun `resuming after a mismatch copies the file again`() {
    val runner = fx.runner {
      if (it.phase == MovePhase.VERIFYING && it.path == null) fx.write(fx.cardRoot, DRUMS, "corrupt".toByteArray())
    }
    runner.start(card)
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertMovedToCard()
  }

  @Test
  fun `cancelling mid-copy deletes only the target copies`() {
    lateinit var runner: MoveRunner
    runner = fx.runner { if (it.phase == MovePhase.COPYING && it.path != null) assertTrue(runner.cancel()) }
    assertEquals(MoveOutcome.Cancelled, runner.start(card))
    assertSourceUntouched()
    assertTrue(cardHasNoFiles())
    assertNull(runner.pending())
  }

  @Test
  fun `cancelling after the switch is refused`() {
    fx.released = false
    val runner = fx.runner()
    assertEquals(MoveOutcome.AwaitingRelease, runner.start(card))
    assertFalse(runner.cancel())
    assertEquals(card, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
  }

  @Test
  fun `files imported, changed or removed mid-move are caught up`() {
    val imported = "new song".toByteArray()
    val changed = "re-analysed".toByteArray()
    var done = false
    val runner = fx.runner {
      if (it.phase == MovePhase.COPYING && it.path == WAVEFORM && !done) {
        done = true
        fx.write(fx.internalRoot, IMPORTED, imported)
        fx.write(fx.internalRoot, WAVEFORM, changed).setLastModified(System.currentTimeMillis() + LATER_MS)
        File(fx.internalRoot, BASS).delete()
      }
    }
    assertEquals(MoveOutcome.Done, runner.start(card))
    val expected = library - BASS + (IMPORTED to imported) + (WAVEFORM to changed)
    assertEquals(fx.hashes(expected), fx.visibleFiles(fx.cardRoot))
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.internalRoot))
  }

  @Test
  fun `imports are blocked only during catch-up and the switch`() {
    val samples = mutableListOf<Pair<MoveProgress, Boolean>>()
    val runner = fx.runner {
      samples.add(it to fx.readerCanEnter())
      if (it.phase == MovePhase.COPYING && it.path == SONG) fx.write(fx.internalRoot, IMPORTED, "new".toByteArray())
    }
    assertEquals(MoveOutcome.Done, runner.start(card))
    val (held, free) = samples.partition { it.first.phase == MovePhase.CATCH_UP && it.first.path != null }
    assertEquals(listOf(IMPORTED), held.map { it.first.path })
    assertTrue(held.none { it.second })
    assertTrue(free.all { it.second })
  }

  @Test
  fun `the switch waits for an import in flight`() {
    val atCatchUp = CountDownLatch(1)
    val importing = fx.folder.importLock.readLock().apply { lock() }
    var outcome: MoveOutcome? = null
    val mover = Thread {
      outcome = fx.runner { if (it.phase == MovePhase.CATCH_UP) atCatchUp.countDown() }.start(card)
    }
    mover.start()
    assertTrue(atCatchUp.await(WAIT_SECONDS, TimeUnit.SECONDS))
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS)
    while (!fx.folder.importLock.hasQueuedThreads()) assertTrue(System.nanoTime() < deadline)
    fx.write(fx.internalRoot, IMPORTED, "late".toByteArray())
    assertEquals(DataFolderLocation.Internal, fx.location())
    importing.unlock()
    mover.join()
    assertEquals(MoveOutcome.Done, outcome)
    assertTrue(File(fx.cardRoot, IMPORTED).isFile)
  }

  @Test
  fun `clean-up waits for the release gate and is safe to repeat`() {
    val gateSaw = mutableListOf<File>()
    fx.released = false
    assertEquals(MoveOutcome.AwaitingRelease, fx.runner().start(card))
    assertEquals(card, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
    assertEquals(MoveOutcome.AwaitingRelease, fx.newProcess().resume())

    fx.released = true
    File(fx.internalRoot, SONG).delete()
    val runner = MoveRunner(fx.folder, fx.journal(), fx.leftovers(), { Long.MAX_VALUE }, { gateSaw.add(it); true })
    assertEquals(MoveOutcome.Done, runner.resume())
    assertEquals(listOf(fx.internalRoot), gateSaw)
    assertMovedToCard()
    assertEquals(MoveOutcome.NoMove, fx.newProcess().resume())
  }

  @Test
  fun `too little free space refuses the move and leaves nothing behind`() {
    val total = library.values.sumOf { it.size.toLong() }
    fx.freeBytes = total + MoveRunner.FREE_SPACE_MARGIN_BYTES - 1
    assertEquals(MoveOutcome.Failed(MoveFailure.NO_SPACE), fx.runner().start(card))
    assertSourceUntouched()
    assertTrue(cardHasNoFiles())
    assertNull(fx.runner().pending())

    fx.freeBytes = total + MoveRunner.FREE_SPACE_MARGIN_BYTES
    assertEquals(MoveOutcome.Done, fx.runner().start(card))
  }

  @Test
  fun `a target that cannot be written refuses the move`() {
    fx.cardRoot.writeText("not a folder")
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_NOT_WRITABLE), fx.runner().start(card))
    assertSourceUntouched()
    assertNull(fx.runner().pending())
  }

  @Test
  fun `a target that already holds a library file refuses the move and keeps it`() {
    val theirs = fx.write(fx.cardRoot, DRUMS, "theirs".toByteArray())
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_OCCUPIED), fx.runner().start(card))
    assertEquals("theirs", theirs.readText())
    assertSourceUntouched()
  }

  @Test
  fun `an unmounted target refuses the move`() {
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_UNAVAILABLE), fx.runner().start(card))
    assertSourceUntouched()
  }

  @Test
  fun `a corrupt journal means no move and deletes nothing`() {
    fx.write(fx.cardRoot, IMPORTED, "on the card".toByteArray())
    fx.journalFile.writeText("{not json")
    val runner = fx.runner()
    assertNull(runner.pending())
    assertEquals(MoveOutcome.NoMove, runner.resume())
    assertFalse(runner.cancel())
    assertSourceUntouched()
    assertTrue(File(fx.cardRoot, IMPORTED).isFile)
    assertEquals("{not json", fx.journalFile.readText())
    assertEquals(1, fx.warnings.size)
  }

  private companion object {
    const val LATER_MS = 10_000L
    const val WAIT_SECONDS = 10L
  }
}
