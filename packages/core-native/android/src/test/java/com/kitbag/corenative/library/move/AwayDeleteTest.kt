package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryDeletes
import com.kitbag.corenative.library.LibraryFile
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
import org.junit.Before
import org.junit.Test

class AwayDeleteTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture
  private val card = DataFolderLocation.Card(CARD_UUID)

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("away-delete").toFile()
    fx = MoveFixture(temp)
    fx.folder.select(card)
    fx.seedLibrary(fx.cardRoot)
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    assertNull(fx.runner().useInternalStorage(listOf(SONG, WAVEFORM, DRUMS, BASS)))
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun mountCard(mounted: Boolean) {
    fx.volumes.volumes = listOf(fx.card(mounted))
  }

  private fun awayList() = AwayManifest(File(fx.filesDir, AwayManifest.FILE_NAME), { _, _ -> }).load()

  private fun onCard() = fx.visibleFiles(fx.cardRoot).keys

  @Test
  fun `deleting an away song with its card mounted removes its files there and its paths from the away list`() {
    mountCard(true)
    LibraryDeletes.songFolder(fx.folder, SONG_FOLDER)
    assertEquals(setOf(DRUMS, BASS), onCard())
    assertEquals(mapOf(CARD_UUID to setOf(DRUMS, BASS)), awayList())
    assertEquals(LibraryFile.Missing, fx.folder.resolve(SONG))
  }

  @Test
  fun `deleting an away stem song with its card mounted removes its files there and its paths from the away list`() {
    mountCard(true)
    LibraryDeletes.stemFolder(fx.folder, STEM_FOLDER)
    assertEquals(setOf(SONG, WAVEFORM), onCard())
    assertEquals(mapOf(CARD_UUID to setOf(SONG, WAVEFORM)), awayList())
  }

  @Test
  fun `deleting one away file with its card mounted removes only that file`() {
    mountCard(true)
    LibraryDeletes.file(fx.folder, WAVEFORM)
    assertEquals(setOf(SONG, DRUMS, BASS), onCard())
    assertEquals(mapOf(CARD_UUID to setOf(SONG, DRUMS, BASS)), awayList())
  }

  @Test
  fun `deleting an away song with its card out drops it from the away list only`() {
    LibraryDeletes.songFolder(fx.folder, SONG_FOLDER)
    LibraryDeletes.stemFolder(fx.folder, STEM_FOLDER)
    assertEquals(emptyMap<String, Set<String>>(), awayList())
    mountCard(true)
    assertEquals(setOf(SONG, WAVEFORM, DRUMS, BASS), onCard())
  }

  @Test
  fun `a song deleted while its card was out is not copied back when the card returns`() {
    LibraryDeletes.songFolder(fx.folder, SONG_FOLDER)
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertEquals(setOf(DRUMS, BASS), fx.visibleFiles(fx.internalRoot).keys)
  }

  @Test
  fun `a stem song deleted while its card was out is not copied back when the card returns`() {
    LibraryDeletes.stemFolder(fx.folder, STEM_FOLDER)
    mountCard(true)
    assertEquals(MoveOutcome.Done, fx.runner().returnCard(card))
    assertEquals(setOf(SONG, WAVEFORM), fx.visibleFiles(fx.internalRoot).keys)
  }

  @Test
  fun `a song deleted while its card returns is not placed on internal storage`() {
    mountCard(true)
    var deleted = false
    val deleteDuringCopy = { progress: MoveProgress ->
      if (!deleted && progress.phase == MovePhase.COPYING && progress.path != null) {
        deleted = true
        LibraryDeletes.songFolder(fx.folder, SONG_FOLDER)
      }
    }
    assertEquals(MoveOutcome.Done, fx.runner(deleteDuringCopy).returnCard(card))
    assertEquals(setOf(DRUMS, BASS), fx.visibleFiles(fx.internalRoot).keys)
    assertFalse(File(fx.internalRoot, CardReturn.STAGING_DIR_NAME).walkTopDown().any { it.isFile })
  }

  @Test
  fun `deleting a song on internal storage leaves the away list alone`() {
    fx.write(fx.internalRoot, IMPORTED, "here".toByteArray())
    LibraryDeletes.songFolder(fx.folder, IMPORTED_FOLDER)
    assertFalse(File(fx.internalRoot, IMPORTED).exists())
    assertEquals(mapOf(CARD_UUID to setOf(SONG, WAVEFORM, DRUMS, BASS)), awayList())
  }

  @Test
  fun `a path that escapes the library is refused with the card mounted or out`() {
    for (mounted in listOf(true, false)) {
      mountCard(mounted)
      assertThrows(UnsafeLibraryPathException::class.java) { LibraryDeletes.songFolder(fx.folder, "..") }
      assertThrows(UnsafeLibraryPathException::class.java) { LibraryDeletes.file(fx.folder, "songs/../../card/x") }
      assertEquals(mapOf(CARD_UUID to setOf(SONG, WAVEFORM, DRUMS, BASS)), awayList())
    }
  }

  companion object {
    private const val SONG_FOLDER = "a"
    private const val STEM_FOLDER = "job1"
    private const val IMPORTED_FOLDER = "b"
  }
}
