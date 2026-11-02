package com.kitbag.corenative.transport

import android.support.v4.media.session.PlaybackStateCompat
import com.kitbag.corenative.transport.TransportAction.PAUSE
import com.kitbag.corenative.transport.TransportAction.PLAY
import com.kitbag.corenative.transport.TransportAction.STOP
import com.kitbag.corenative.transport.TransportAction.TEMPO_DOWN
import com.kitbag.corenative.transport.TransportAction.TEMPO_UP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MetronomeSessionTest {
  private val model = TransportModel(minBpm = 20.0, maxBpm = 400.0)

  private fun view(playback: Playback = Playback.PLAYING, subtitle: String? = SUBTITLE): TransportView =
    model.view(
      TransportState(playback, bpm = 96.0, rampRunning = false, beatsPerBar = 6, beatUnit = 8, subtitle = subtitle),
    )

  private val shownStates = listOf(Playback.PLAYING, Playback.PAUSED).flatMap { playback ->
    listOf(SUBTITLE, null).map { view(playback, it) }
  }

  @Test
  fun `the session offers play, pause, play-pause and stop, and never skips or seeks`() {
    val expected =
      PlaybackStateCompat.ACTION_PLAY or
        PlaybackStateCompat.ACTION_PAUSE or
        PlaybackStateCompat.ACTION_PLAY_PAUSE or
        PlaybackStateCompat.ACTION_STOP
    assertEquals(expected, MetronomeSession.ACTION_MASK)
  }

  @Test
  fun `custom actions are minus, plus, stop in that order, with or without a setlist`() {
    for (shown in shownStates) {
      assertEquals(listOf(TEMPO_DOWN, TEMPO_UP, STOP), MetronomeSession.customActions(shown.actions))
    }
  }

  @Test
  fun `the compact card before Android 13 is play or pause between the tempo keys`() {
    val playing = view().actions
    assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP), MetronomeSession.compactSlots(playing).map(playing::get))
    val paused = view(Playback.PAUSED, subtitle = null).actions
    assertEquals(listOf(TEMPO_DOWN, PLAY, TEMPO_UP), MetronomeSession.compactSlots(paused).map(paused::get))
  }

  @Test
  fun `the compact card stays within the platform's three slots and never names stop`() {
    val crowded = listOf(TEMPO_DOWN, PLAY, PAUSE, TEMPO_UP, STOP)
    val slots = MetronomeSession.compactSlots(crowded)
    assertTrue(slots.size <= PLATFORM_COMPACT_LIMIT)
    assertTrue(slots.all { it in crowded.indices })
    assertEquals(slots.size, slots.distinct().size)
    assertTrue(slots.none { crowded[it] == STOP })
  }

  private companion object {
    const val SUBTITLE = "Wedding set · Blackbird (3/12)"
    const val PLATFORM_COMPACT_LIMIT = 3
  }
}
