package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.Waveforms
import com.kitbag.corenative.library.move.MoveFixture.Companion.DRUMS
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
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MoveSafetyTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var library: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(MoveFixture.CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("move-safety").toFile()
    fx = MoveFixture(temp)
    library = fx.seedLibrary(fx.internalRoot)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun killAt(phase: MovePhase) {
    val killer = fx.runner { if (it.phase == phase && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(card) }
  }

  @Test
  fun `a kill between the switch and its journal save refuses cancel and resumes on the live card`() {
    killAt(MovePhase.CATCH_UP)
    fx.folder.select(card)
    assertFalse(fx.newProcess().cancel())
    assertEquals(card, fx.location())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))

    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
    assertEquals(emptyMap<String, String>(), fx.visibleFiles(fx.internalRoot))
  }

  @Test
  fun `cancelling a move that never left preflight deletes nothing on the target`() {
    killAt(MovePhase.PREFLIGHT)
    val theirs = fx.write(fx.cardRoot, DRUMS, "theirs".toByteArray())
    assertTrue(fx.newProcess().cancel())
    assertEquals("theirs", theirs.readText())
    assertEquals(null, fx.newProcess().pending())
  }

  @Test
  fun `catch-up refuses a new path the target already holds and keeps that file`() {
    var done = false
    val runner = fx.runner {
      if (it.phase == MovePhase.COPYING && it.path != null && !done) {
        done = true
        fx.write(fx.cardRoot, IMPORTED, "theirs".toByteArray())
        fx.write(fx.internalRoot, IMPORTED, "mine".toByteArray())
      }
    }
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_OCCUPIED, IMPORTED), runner.start(card))
    assertEquals("theirs", File(fx.cardRoot, IMPORTED).readText())
    assertEquals(DataFolderLocation.Internal, fx.location())
    val paused = fx.newProcess().pending()!!
    assertEquals(MovePhase.CATCH_UP, paused.phase)
    assertEquals(MoveFailure.TARGET_OCCUPIED, paused.failure)
  }

  @Test
  fun `a catch-up copy killed before its hash was saved is copied again on resume`() {
    var copies = 0
    val killer = fx.runner {
      if (it.phase == MovePhase.COPYING && it.path == SONG) fx.write(fx.internalRoot, IMPORTED, "new".toByteArray())
      if (it.phase == MovePhase.CATCH_UP && it.path != null && ++copies == 1) throw MoveFixture.Killed()
    }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(card) }
    val journal = MoveJournal(fx.journalFile) { _, _ -> }
    val killed = journal.load()!!
    val unjournalled = killed.files.map { if (it.path == IMPORTED) it.copy(sha256 = null, verified = false) else it }
    journal.save(killed.copy(files = unjournalled))
    assertTrue(File(fx.cardRoot, IMPORTED).isFile)

    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertEquals("new", File(fx.cardRoot, IMPORTED).readText())
  }

  @Test
  fun `a waveform written during catch-up lands in the target`() {
    val staged = fx.write(File(temp, "staging"), "a.kwav", "fresh peaks".toByteArray())
    var placed: String? = null
    var started = false
    val analysis = Thread { placed = Waveforms.place(fx.folder, "songs/a", staged, fx.runner()::supersede, { _, _ -> }) }
    val runner = fx.runner {
      if (it.phase == MovePhase.COPYING && it.path == SONG) fx.write(fx.internalRoot, IMPORTED, "new".toByteArray())
      if (it.phase == MovePhase.CATCH_UP && it.path != null && !started) {
        started = true
        analysis.start()
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS)
        while (!fx.folder.importLock.hasQueuedThreads()) assertTrue(System.nanoTime() < deadline)
      }
    }
    assertEquals(MoveOutcome.Done, runner.start(card))
    analysis.join()
    assertEquals(WAVEFORM, placed)
    assertEquals("fresh peaks", File(fx.cardRoot, WAVEFORM).readText())
    assertFalse(File(fx.internalRoot, WAVEFORM).exists())
  }

  @Test
  fun `cancel is refused while the state file is unreadable and an internal target may be live`() {
    fx = MoveFixture(File(temp, "from-card"))
    fx.folder.select(card)
    library = fx.seedLibrary(fx.cardRoot)
    val killer = fx.runner { if (it.phase == MovePhase.VERIFYING && it.path == null) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.start(DataFolderLocation.Internal) }
    File(fx.filesDir, DataFolder.STATE_FILE_NAME).writeText("{not json")

    assertFalse(fx.newProcess().cancel())
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
    assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
  }

  @Test
  fun `a cancel racing a resume never discards copies the resumed move relies on`() {
    killAt(MovePhase.CATCH_UP)
    val loaded = CountDownLatch(1)
    val cancelled = CountDownLatch(1)
    lateinit var resumer: Thread
    val journal = object : MoveJournal(fx.journalFile, { _, _ -> }) {
      override fun load(): MoveState? =
        super.load().also {
          if (Thread.currentThread() == resumer && loaded.count > 0) {
            loaded.countDown()
            cancelled.await(RACE_WINDOW_MS, TimeUnit.MILLISECONDS)
          }
        }
    }
    fx.folder = fx.newFolder()
    val runner = MoveRunner(fx.folder, journal, fx.leftovers(), { Long.MAX_VALUE }, { true })
    var outcome: MoveOutcome? = null
    resumer = Thread { outcome = runner.resume() }
    resumer.start()
    assertTrue(loaded.await(WAIT_SECONDS, TimeUnit.SECONDS))
    val accepted = runner.cancel()
    cancelled.countDown()
    resumer.join()

    if (fx.location() == card) {
      assertFalse(accepted)
      assertEquals(MoveOutcome.Done, outcome)
      assertEquals(fx.hashes(library), fx.visibleFiles(fx.cardRoot))
    } else {
      assertEquals(MoveOutcome.Cancelled, outcome)
      assertEquals(fx.hashes(library), fx.visibleFiles(fx.internalRoot))
    }
  }

  private companion object {
    const val RACE_WINDOW_MS = 500L
    const val WAIT_SECONDS = 10L
  }
}
