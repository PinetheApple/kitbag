package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryDeletes
import com.kitbag.corenative.library.LibraryFile
import com.kitbag.corenative.library.UnreadableStateException
import com.kitbag.corenative.library.UnsafeLibraryPathException
import com.kitbag.corenative.library.move.MoveFixture.Companion.BASS
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.DRUMS
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

class AwayDeleteTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private val card = DataFolderLocation.Card(CARD_UUID)
  private val allAway = mapOf(CARD_UUID to setOf(SONG, WAVEFORM, DRUMS, BASS))

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("away-delete").toFile()
    fx = MoveFixture(temp)
    fx.folder.select(card)
    fx.seedLibrary(fx.cardRoot)
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    assertNull(fx.runner().useInternalStorage(allAway.getValue(CARD_UUID)))
  }

  @After
  fun tearDown() {
    File(fx.cardRoot, SONG).parentFile.setWritable(true)
    temp.deleteRecursively()
  }

  private fun deletes() = LibraryDeletes(fx.folder, fx.leftovers()) { message, _ -> fx.warnings.add(message) }

  private fun mountCard(mounted: Boolean) {
    fx.volumes.volumes = listOf(fx.card(mounted))
  }

  private fun awayList() = AwayManifest(File(fx.filesDir, AwayManifest.FILE_NAME), { _, _ -> }).load()

  private fun onCard() = fx.visibleFiles(fx.cardRoot).keys

  private fun onInternal() = fx.visibleFiles(fx.internalRoot).keys

  private fun stagedFiles() =
    File(fx.internalRoot, CardReturn.STAGING_DIR_NAME).walkTopDown().filter { it.isFile }.toList()

  @Test
  fun `deleting an away song with its card mounted removes its files there and its paths from the away list`() {
    mountCard(true)
    deletes().songFolder(SONG_FOLDER)
    assertEquals(setOf(DRUMS, BASS), onCard())
    assertEquals(mapOf(CARD_UUID to setOf(DRUMS, BASS)), awayList())
    assertEquals(emptyMap<String, Set<String>>(), fx.leftovers().load())
    assertEquals(LibraryFile.Missing, fx.folder.resolve(SONG))
  }

  @Test
  fun `deleting an away stem song with its card mounted removes its files there and its paths from the away list`() {
    mountCard(true)
    deletes().stemFolder(STEM_FOLDER)
    assertEquals(setOf(SONG, WAVEFORM), onCard())
    assertEquals(mapOf(CARD_UUID to setOf(SONG, WAVEFORM)), awayList())
  }

  @Test
  fun `deleting one away file with its card mounted removes only that file`() {
    mountCard(true)
    deletes().file(WAVEFORM)
    assertEquals(setOf(SONG, DRUMS, BASS), onCard())
    assertEquals(mapOf(CARD_UUID to setOf(SONG, DRUMS, BASS)), awayList())
  }

  @Test
  fun `deleting an away song with its card out moves its paths from the away list to the clean-up list`() {
    deletes().songFolder(SONG_FOLDER)
    deletes().stemFolder(STEM_FOLDER)
    assertEquals(emptyMap<String, Set<String>>(), awayList())
    assertEquals(allAway, fx.leftovers().load())
    mountCard(true)
    assertEquals(setOf(SONG, WAVEFORM, DRUMS, BASS), onCard())
  }

  @Test
  fun `a song deleted with its card out is reclaimed by a move to that card, not refused as leftovers`() {
    deletes().songFolder(SONG_FOLDER)
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner().start(card))
    assertEquals(card, fx.location())
    assertEquals(setOf(DRUMS, BASS), onCard())
    assertEquals(emptyMap<String, Set<String>>(), fx.leftovers().load())
  }

  @Test
  fun `a card delete that fails still clears the away list and lists the files for clean-up`() {
    mountCard(true)
    File(fx.cardRoot, SONG).parentFile.setWritable(false)
    deletes().songFolder(SONG_FOLDER)
    assertEquals(mapOf(CARD_UUID to setOf(DRUMS, BASS)), awayList())
    assertEquals(mapOf(CARD_UUID to setOf(SONG, WAVEFORM)), fx.leftovers().load())
    assertEquals(1, fx.warnings.size)
  }

  @Test
  fun `an unreadable away list fails the delete before any data folder file is touched`() {
    val imported = fx.write(fx.internalRoot, IMPORTED, "here".toByteArray())
    File(fx.filesDir, AwayManifest.FILE_NAME).writeText("{not json")
    assertThrows(UnreadableStateException::class.java) { deletes().songFolder(IMPORTED_FOLDER) }
    assertThrows(UnreadableStateException::class.java) { deletes().file(IMPORTED) }
    assertTrue(imported.isFile)
  }

  @Test
  fun `deleting a file matches the exact path, never a folder of the same name`() {
    deletes().file("songs/$SONG_FOLDER")
    assertEquals(allAway, awayList())
    deletes().file("songs/./$SONG_FOLDER//a.mp3")
    assertEquals(mapOf(CARD_UUID to setOf(WAVEFORM, DRUMS, BASS)), awayList())
  }

  @Test
  fun `a song deleted while its card was out is not copied back when the card returns`() {
    deletes().songFolder(SONG_FOLDER)
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertEquals(setOf(DRUMS, BASS), onInternal())
    assertEquals(emptySet<String>(), onCard())
  }

  @Test
  fun `a stem song deleted while its card was out is not copied back when the card returns`() {
    deletes().stemFolder(STEM_FOLDER)
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertEquals(setOf(SONG, WAVEFORM), onInternal())
  }

  @Test
  fun `a song deleted while its card returns is not placed on internal storage`() {
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner(deleteOnce(MovePhase.COPYING)).returnCard(card))
    assertEquals(setOf(DRUMS, BASS), onInternal())
    assertEquals(emptyList<File>(), stagedFiles())
  }

  @Test
  fun `a song deleted while the return verifies is not placed on internal storage`() {
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner(deleteOnce(MovePhase.VERIFYING)).returnCard(card))
    assertEquals(setOf(DRUMS, BASS), onInternal())
    assertEquals(emptyList<File>(), stagedFiles())
  }

  @Test
  fun `a song placed before a kill and deleted before the resume stays deleted`() {
    mountCard(true)
    var placed = 0
    val killMidPlacement = { progress: MoveProgress ->
      if (progress.phase >= MovePhase.CATCH_UP && progress.path != null && ++placed == PLACED_BEFORE_KILL) {
        throw MoveFixture.Killed()
      }
    }
    assertThrows(MoveFixture.Killed::class.java) { fx.runner(killMidPlacement).returnCard(card) }
    assertTrue(fx.newProcess().pending()!!.placing)
    assertTrue(File(fx.internalRoot, SONG).isFile)
    deletes().songFolder(SONG_FOLDER)
    assertEquals(MoveOutcome.Done, fx.newProcess().resume())
    assertEquals(setOf(DRUMS, BASS), onInternal())
    assertEquals(emptyList<File>(), stagedFiles())
    assertEquals(emptyMap<String, Set<String>>(), awayList())
  }

  @Test
  fun `deleting a song on internal storage leaves the away list alone`() {
    fx.write(fx.internalRoot, IMPORTED, "here".toByteArray())
    deletes().songFolder(IMPORTED_FOLDER)
    assertFalse(File(fx.internalRoot, IMPORTED).exists())
    assertEquals(allAway, awayList())
  }

  @Test
  fun `a path that escapes the library is refused with the card mounted or out`() {
    for (mounted in listOf(true, false)) {
      mountCard(mounted)
      assertThrows(UnsafeLibraryPathException::class.java) { deletes().songFolder("..") }
      assertThrows(UnsafeLibraryPathException::class.java) { deletes().file("songs/../../card/x") }
      assertEquals(allAway, awayList())
    }
  }

  private fun deleteOnce(phase: MovePhase): (MoveProgress) -> Unit {
    var deleted = false
    return { progress ->
      if (!deleted && progress.phase == phase && progress.path != null) {
        deleted = true
        deletes().songFolder(SONG_FOLDER)
      }
    }
  }

  companion object {
    private const val SONG_FOLDER = "a"
    private const val STEM_FOLDER = "job1"
    private const val IMPORTED_FOLDER = "b"
    private const val PLACED_BEFORE_KILL = 2
  }
}
