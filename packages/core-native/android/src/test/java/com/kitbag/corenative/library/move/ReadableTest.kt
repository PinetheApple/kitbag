package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.DataFolderUnavailableException
import com.kitbag.corenative.library.UnsafeLibraryPathException
import com.kitbag.corenative.library.move.MoveFixture.Companion.CARD_UUID
import com.kitbag.corenative.library.move.MoveFixture.Companion.IMPORTED
import com.kitbag.corenative.library.move.MoveFixture.Companion.SONG
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test

class ReadableTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("readable").toFile()
    fx = MoveFixture(temp)
    fx.folder.select(DataFolderLocation.Card(CARD_UUID))
    fx.write(fx.cardRoot, SONG, "on the card".toByteArray())
    fx.volumes.volumes = listOf(fx.card(mounted = false))
    assertNull(fx.runner().useInternalStorage(listOf(SONG)))
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  @Test
  fun `an away song reads from its card while the card is in`() {
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    assertEquals(File(fx.cardRoot, SONG).canonicalFile, fx.folder.readable(SONG))
  }

  @Test
  fun `an away song whose card is out is unavailable, not missing`() {
    val error = assertThrows(DataFolderUnavailableException::class.java) { fx.folder.readable(SONG) }
    assertEquals(CARD_UUID, error.volumeUuid)
  }

  @Test
  fun `a song in the data folder reads from the data folder`() {
    val imported = fx.write(fx.internalRoot, IMPORTED, "here".toByteArray())
    assertEquals(imported.canonicalFile, fx.folder.readable(IMPORTED))
  }

  @Test
  fun `a missing song reads from where the data folder would hold it`() {
    assertEquals(File(fx.internalRoot, MISSING).canonicalFile, fx.folder.readable(MISSING))
  }

  @Test
  fun `a path escaping the library is refused on the card branch too`() {
    fx.volumes.volumes = listOf(fx.card(mounted = true))
    ESCAPES.forEach { path ->
      assertThrows(path, UnsafeLibraryPathException::class.java) { fx.folder.readable(path) }
    }
  }

  companion object {
    private const val MISSING = "songs/gone/gone.mp3"
    private val ESCAPES = listOf("../library/$SONG", "songs/../../$SONG", "/$SONG")
  }
}
