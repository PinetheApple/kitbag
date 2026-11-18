package com.kitbag.corenative.stemdeck

import org.junit.Assert.assertEquals
import org.junit.Test

class DownloadSpaceTest {
  private class Volumes(val download: Long, val library: Long, val same: Boolean) : FreeSpace {
    override fun downloadBytes() = download

    override fun libraryBytes() = library

    override fun sameVolume() = same
  }

  private fun verdict(space: SpaceVerdict) = Triple(space.fits, space.neededBytes, space.freeBytes)

  @Test
  fun `one volume holds the zip and the imported stems at once`() {
    val space = DownloadSpace(Volumes(download = 210, library = 210, same = true), marginBytes = 10)
    assertEquals(Triple(true, 210L, 210L), verdict(space.forLength(100)))
    assertEquals(Triple(false, 212L, 210L), verdict(space.forLength(101)))
  }

  @Test
  fun `two volumes each need the bundle once`() {
    val space = DownloadSpace(Volumes(download = 500, library = 105, same = false), marginBytes = 10)
    assertEquals(Triple(false, 110L, 105L), verdict(space.forLength(100)))
    assertEquals(true, space.forLength(95).fits)
  }

  @Test
  fun `an unknown length is checked as it grows`() {
    val space = DownloadSpace(Volumes(download = 5, library = 0, same = true), marginBytes = 10)
    assertEquals(false, space.whileStreaming(1000).fits)
    assertEquals(false, space.recheckDue(DownloadSpace.RECHECK_BYTES - 1, 0))
    assertEquals(true, space.recheckDue(DownloadSpace.RECHECK_BYTES, 0))
  }
}
