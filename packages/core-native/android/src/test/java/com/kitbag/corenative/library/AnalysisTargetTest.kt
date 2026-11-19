package com.kitbag.corenative.library

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AnalysisTargetTest {
  @get:Rule val temp = TemporaryFolder()

  @Test
  fun `a mounted root analyses the canonical path`() {
    val root = temp.newFolder("library")
    assertEquals(AnalysisTarget.Ready(SONG), AnalysisTarget.of({ root }, "songs/a/./a.mp3", WAVEFORM_DIR))
  }

  @Test
  fun `a path that escapes the library is refused`() {
    val root = temp.newFolder("library")
    assertEquals(AnalysisTarget.Refused, AnalysisTarget.of({ root }, "../a.mp3", WAVEFORM_DIR))
  }

  @Test
  fun `an unmounted card defers the analysis instead of failing it`() {
    val unmounted: () -> File = { throw DataFolderUnavailableException(CARD_UUID) }
    assertEquals(AnalysisTarget.Deferred, AnalysisTarget.of(unmounted, SONG, WAVEFORM_DIR))
  }

  private companion object {
    const val CARD_UUID = "1234-ABCD"
    const val SONG = "songs/a/a.mp3"
    const val WAVEFORM_DIR = "songs/a"
  }
}
