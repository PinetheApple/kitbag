package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.Waveforms
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.WAVEFORM
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
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

  private fun reanalyse() {
    val staged = fx.write(File(temp, STAGING_DIR), File(WAVEFORM).name, NEW_PEAKS.toByteArray())
    Waveforms.place(fx.folder, File(WAVEFORM).parent, staged, fx.runner()::supersede)
  }

  private fun waveformCopies(): List<File> =
    listOf(fx.internalRoot, fx.cardRoot).flatMap { root ->
      root.walkTopDown().filter { it.name == File(WAVEFORM).name }
    }

  private fun assertReturnedWithNewestWaveform() {
    fx.runner().finishLeftovers()
    val internalWaveform = File(fx.internalRoot, WAVEFORM).canonicalFile
    assertEquals(listOf(internalWaveform), waveformCopies().map { it.canonicalFile })
    assertEquals(NEW_PEAKS, internalWaveform.readText())
    assertEquals(LibraryFile.Present(internalWaveform), fx.folder.resolve(WAVEFORM))
    assertEquals(fx.hashes(away - WAVEFORM), fx.visibleFiles(fx.internalRoot) - WAVEFORM)
    assertEquals(emptyMap<String, Set<String>>(), awayList())
    assertEquals(emptyMap<String, Set<String>>(), fx.leftovers().load())
    assertFalse(fx.journalFile.exists())
  }

  private fun awayList() = AwayManifest(File(fx.filesDir, AwayManifest.FILE_NAME), { _, _ -> }).load()

  private fun beforePlacing(progress: MoveProgress) = progress.phase == MovePhase.CATCH_UP && progress.path == null

  @Test
  fun `a song re-analysed before the return still moves back with its new waveform`() {
    reanalyse()
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertReturnedWithNewestWaveform()
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
  }

  @Test
  fun `a re-analysis while a killed return waits to be resumed keeps the new waveform`() {
    val killer = fx.runner { if (beforePlacing(it)) throw MoveFixture.Killed() }
    assertThrows(MoveFixture.Killed::class.java) { killer.returnCard(card) }
    fx.folder = fx.newFolder()
    reanalyse()
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertReturnedWithNewestWaveform()
  }

  @Test
  fun `a song re-analysed after the return keeps one new waveform`() {
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    reanalyse()
    assertReturnedWithNewestWaveform()
  }

  companion object {
    private const val NEW_PEAKS = "re-analysed peaks"
    private const val STAGING_DIR = "analysis-staging"
  }
}
