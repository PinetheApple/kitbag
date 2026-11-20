package com.kitbag.corenative.transport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SongEndWatchTest {
  private var count = 0L
  private fun watch() = SongEndWatch { count }

  @Test
  fun endsCountedBeforeTheWatchStartedAreNotReported() {
    count = 3
    assertFalse(watch().ended())
  }

  @Test
  fun aNewEndIsReportedOnce() {
    val watch = watch()
    count++
    assertTrue(watch.ended())
    assertFalse(watch.ended())
  }

  @Test
  fun severalEndsBetweenTwoReadsAreOneReport() {
    val watch = watch()
    count += 2
    assertEquals(listOf(true, false), listOf(watch.ended(), watch.ended()))
  }

  @Test
  fun eachLaterEndIsReported() {
    val watch = watch()
    count++
    watch.ended()
    count++
    assertTrue(watch.ended())
  }
}
