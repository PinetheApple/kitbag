package com.kitbag.corenative.transport

import android.support.v4.media.session.PlaybackStateCompat
import com.kitbag.corenative.transport.SongAction.FORWARD
import com.kitbag.corenative.transport.SongAction.NEXT
import com.kitbag.corenative.transport.SongAction.PAUSE
import com.kitbag.corenative.transport.SongAction.PLAY
import com.kitbag.corenative.transport.SongAction.PREVIOUS
import com.kitbag.corenative.transport.SongAction.REWIND
import com.kitbag.corenative.transport.SongAction.STOP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SongSlotsTest {
  private val rate = 48_000.0
  private val song = Song(
    title = "Night Bus",
    artist = null,
    durationFrames = 180 * 48_000L,
    restartFromFrame = 180 * 48_000L - 12_000L,
    skipSeconds = 10.0,
  )
  private val transport = SongTransport(song, rate)
  private val skipToPrevious = PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
  private val skipToNext = PlaybackStateCompat.ACTION_SKIP_TO_NEXT

  private fun at(seconds: Double, playing: Boolean = true) = SongProgress(playing, (seconds * rate).toLong())

  private fun counting(seconds: Double) = SongProgress(false, (seconds * rate).toLong(), countingIn = true)

  private fun sessionActions(order: SongOrder) = transport.playback(at(5.0), order, now = 0L).actions

  @Test
  fun `with something up next the card is previous, play or pause, next, then the two skips`() {
    val slots = transport.slots(at(5.0), SongOrder.UP_NEXT)
    assertEquals(listOf(PREVIOUS, PAUSE, NEXT, REWIND, FORWARD), slots.actions)
    val paused = transport.slots(at(5.0, playing = false), SongOrder.UP_NEXT)
    assertEquals(listOf(PREVIOUS, PLAY, NEXT, REWIND, FORWARD), paused.actions)
    assertEquals(listOf(0, 1, 2), slots.compact)
    assertFalse(slots.reserveNext)
  }

  @Test
  fun `with something up next the session offers both skips`() {
    assertEquals(skipToPrevious, sessionActions(SongOrder.UP_NEXT) and skipToPrevious)
    assertEquals(skipToNext, sessionActions(SongOrder.UP_NEXT) and skipToNext)
  }

  @Test
  fun `at the last song there is no next, its slot is reserved and compact holds previous and play`() {
    val slots = transport.slots(at(5.0), SongOrder.LAST)
    assertEquals(listOf(PREVIOUS, PAUSE, REWIND, FORWARD), slots.actions)
    assertEquals(listOf(0, 1), slots.compact)
    assertTrue(slots.reserveNext)
    assertEquals(skipToPrevious, sessionActions(SongOrder.LAST) and skipToPrevious)
    assertEquals(0L, sessionActions(SongOrder.LAST) and skipToNext)
  }

  @Test
  fun `a song played alone keeps the built card, with stop and no skip actions`() {
    val slots = transport.slots(at(5.0), SongOrder.ALONE)
    assertEquals(listOf(REWIND, PAUSE, FORWARD, STOP), slots.actions)
    assertEquals(listOf(0, 1, 2), slots.compact)
    assertFalse(slots.reserveNext)
    assertEquals(0L, sessionActions(SongOrder.ALONE) and (skipToPrevious or skipToNext))
  }

  @Test
  fun `stop is dropped only while previous shows`() {
    for (order in SongOrder.entries) {
      val actions = transport.slots(at(5.0), order).actions
      assertEquals(PREVIOUS !in actions, STOP in actions)
    }
  }

  @Test
  fun `the order comes from what the app says is before and after`() {
    assertEquals(SongOrder.UP_NEXT, SongOrder.of(previous = true, next = true))
    assertEquals(SongOrder.UP_NEXT, SongOrder.of(previous = false, next = true))
    assertEquals(SongOrder.LAST, SongOrder.of(previous = true, next = false))
    assertEquals(SongOrder.ALONE, SongOrder.of(previous = false, next = false))
  }

  @Test
  fun `an order name the card does not know reads as alone`() {
    assertEquals(SongOrder.LAST, SongOrder.named("LAST"))
    assertEquals(SongOrder.ALONE, SongOrder.named(null))
    assertEquals(SongOrder.ALONE, SongOrder.named("SHUFFLE"))
  }

  @Test
  fun `previous restarts the song in the engine`() {
    val route = transport.route(at(95.0), PREVIOUS, appListening = true)
    assertEquals(SongRoute(null, listOf(SongCommand.Seek(0L))), route)
  }

  @Test
  fun `previous during a count-in goes to the app as a seek to the top`() {
    val route = transport.route(counting(5.0), PREVIOUS, appListening = true)
    assertEquals(SongRoute(SongCommand.Seek(0L), emptyList()), route)
  }

  @Test
  fun `next always goes to the app and never to the engine`() {
    for (progress in listOf(at(5.0), at(5.0, playing = false), counting(5.0))) {
      assertEquals(SongRoute(SongCommand.Next, emptyList()), transport.route(progress, NEXT, appListening = true))
    }
  }

  @Test
  fun `next with no app listening does nothing`() {
    assertEquals(SongRoute(null, emptyList()), transport.route(at(5.0), NEXT, appListening = false))
  }

  @Test
  fun `next is assumed to change nothing the card shows`() {
    assertEquals(at(5.0), transport.applied(at(5.0), SongCommand.Next))
    assertFalse(SongCommand.Next.endsSong)
  }
}
