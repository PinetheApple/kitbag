package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.PortableVolume
import com.kitbag.corenative.library.VolumeProvider
import com.kitbag.corenative.library.Waveforms
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import com.kitbag.corenative.library.move.MoveFixture.Companion.WAVEFORM
import java.io.File
import java.io.IOException
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CardReturnReanalysisTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private lateinit var away: Map<String, ByteArray>
  private val card = DataFolderLocation.Card(CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("card-return-reanalysis").toFile()
    fx = MoveFixture(temp)
    fx.folder.select(card)
    away = fx.seedLibrary(fx.cardRoot)
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    fx.runner().useInternalStorage(away.keys)
    fx.volumes.volumes = listOf(fx.card(mounted = true))
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun reanalyse(supersede: (String) -> Unit = fx.runner()::supersede): String? {
    val staged = fx.write(File(temp, STAGING_DIR), File(WAVEFORM).name, NEW_PEAKS.toByteArray())
    return Waveforms.place(fx.folder, WAVEFORM_DIR, staged, supersede, { message, _ -> fx.warnings.add(message) })
  }

  private fun waveformCopies(): List<File> =
    listOf(fx.internalRoot, fx.cardRoot).flatMap { root ->
      root.walkTopDown().filter { it.name == File(WAVEFORM).name }
    }

  private fun assertReturnedWithNewestWaveform() {
    val internalWaveform = File(fx.internalRoot, WAVEFORM).canonicalFile
    assertEquals(listOf(internalWaveform), waveformCopies().map { it.canonicalFile })
    assertEquals(NEW_PEAKS, internalWaveform.readText())
    assertEquals(LibraryFile.Present(internalWaveform), fx.folder.resolve(WAVEFORM))
    assertEquals(fx.hashes(away - WAVEFORM), fx.visibleFiles(fx.internalRoot) - WAVEFORM)
    assertEquals(emptyMap<String, Set<String>>(), awayList())
    assertFalse(fx.journalFile.exists())
  }

  private fun assertLeftovers(expected: Map<String, Set<String>>) = assertEquals(expected, fx.leftovers().load())

  private fun assertCardCopyParkedThenCleared() {
    assertEquals(NEW_PEAKS, File(fx.internalRoot, WAVEFORM).readText())
    assertEquals(emptyMap<String, Set<String>>(), awayList())
    assertLeftovers(mapOf(CARD_UUID to setOf(WAVEFORM)))
    assertTrue(fx.runner().finishLeftovers())
    assertReturnedWithNewestWaveform()
    assertLeftovers(emptyMap())
  }

  private fun assertNothingSuperseded() {
    assertEquals(mapOf(CARD_UUID to away.keys), awayList())
    assertLeftovers(emptyMap())
    assertEquals(fx.hashes(away), fx.visibleFiles(fx.cardRoot))
    assertNull(fx.runner().pending())
  }

  private fun awayList() = AwayManifest(File(fx.filesDir, AwayManifest.FILE_NAME), { _, _ -> }).load()

  private fun beforePlacing(progress: MoveProgress) = progress.phase == MovePhase.CATCH_UP && progress.path == null

  @Test
  fun `a song re-analysed before the return still moves back with its new waveform`() {
    reanalyse()
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertReturnedWithNewestWaveform()
    assertLeftovers(emptyMap())
  }

  @Test
  fun `a re-analysis between the preflight and placing keeps the new waveform`() {
    var reanalysed = false
    val runner = fx.runner {
      if (beforePlacing(it) && !reanalysed) {
        reanalysed = true
        reanalyse()
      }
    }
    assertEquals(MoveOutcome.Done, runner.returnCard(card))
    assertReturnedWithNewestWaveform()
    assertLeftovers(mapOf(CARD_UUID to setOf(WAVEFORM)))
    assertTrue(fx.runner().finishLeftovers())
    assertLeftovers(emptyMap())
  }

  @Test
  fun `a re-analysis while a killed return waits to be resumed keeps the new waveform`() {
    val killer = fx.runner { if (beforePlacing(it)) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.returnCard(card) }
    fx.folder = fx.newFolder()
    reanalyse()
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertReturnedWithNewestWaveform()
    assertLeftovers(mapOf(CARD_UUID to setOf(WAVEFORM)))
    assertTrue(fx.runner().finishLeftovers())
    assertLeftovers(emptyMap())
  }

  @Test
  fun `a song re-analysed after the return keeps one new waveform`() {
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    reanalyse()
    assertReturnedWithNewestWaveform()
    assertLeftovers(emptyMap())
  }

  @Test
  fun `a song re-analysed while the card is out moves back with one waveform`() {
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    reanalyse()
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertReturnedWithNewestWaveform()
    assertLeftovers(emptyMap())
  }

  @Test
  fun `a waveform written without superseding the card copy still moves back`() {
    reanalyse { }
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertCardCopyParkedThenCleared()
  }

  @Test
  fun `a failing supersede keeps the analysis and its waveform`() {
    assertEquals(WAVEFORM, reanalyse { throw IOException("unwritable leftovers") })
    assertEquals(NEW_PEAKS, File(fx.internalRoot, WAVEFORM).readText())
    assertEquals(1, fx.warnings.size)
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertCardCopyParkedThenCleared()
  }

  @Test
  fun `a path both parked and away is cleared by leftover clean-up alone`() {
    fx.write(fx.internalRoot, WAVEFORM, NEW_PEAKS.toByteArray())
    fx.leftovers().record(CARD_UUID, listOf(WAVEFORM))
    assertTrue(fx.runner().finishLeftovers())
    assertFalse(File(fx.cardRoot, WAVEFORM).exists())
    assertEquals(away.keys - WAVEFORM, fx.folder.awayOn(CARD_UUID))
    assertLeftovers(emptyMap())
  }

  @Test
  fun `a song-audio clash refuses without superseding the re-analysed waveform`() {
    reanalyse { }
    fx.write(fx.internalRoot, SONG, "clash".toByteArray())
    assertEquals(MoveOutcome.Failed(MoveFailure.TARGET_OCCUPIED), fx.runner().returnCard(card))
    assertNothingSuperseded()
  }

  @Test
  fun `a return refused for space supersedes nothing`() {
    reanalyse { }
    fx.freeBytes = 0
    assertEquals(MoveOutcome.Failed(MoveFailure.NO_SPACE), fx.runner().returnCard(card))
    assertNothingSuperseded()
  }

  @Test(timeout = LOCK_TEST_TIMEOUT_MILLIS)
  fun `a supersede during leftover clean-up keeps the card copy parked`() {
    fx.write(fx.cardRoot, PARKED, "old".toByteArray())
    fx.leftovers().record(CARD_UUID, listOf(PARKED))
    lateinit var runner: MoveRunner
    var analysis: Thread? = null
    val volumes = object : VolumeProvider {
      override fun portable(): List<PortableVolume> {
        if (analysis == null) {
          analysis = Thread { runner.supersede(WAVEFORM) }.also {
            it.start()
            it.awaitBlockedOrDone()
          }
        }
        return fx.volumes.volumes
      }
    }
    runner = MoveRunner(DataFolder(fx.filesDir, volumes) { _, _ -> }, fx.journal(), fx.leftovers(), { fx.freeBytes }, { true })
    runner.finishLeftovers()
    analysis?.join()
    assertLeftovers(mapOf(CARD_UUID to setOf(WAVEFORM)))
    assertEquals(away.keys - WAVEFORM, awayList()?.get(CARD_UUID))
  }

  private fun Thread.awaitBlockedOrDone() {
    while (isAlive && state != Thread.State.BLOCKED) Thread.yield()
  }

  companion object {
    private const val NEW_PEAKS = "re-analysed peaks"
    private const val STAGING_DIR = "analysis-staging"
    private const val WAVEFORM_DIR = "songs/a"
    private const val PARKED = "songs/old/old.mp3"
    private const val LOCK_TEST_TIMEOUT_MILLIS = 10_000L
  }
}
