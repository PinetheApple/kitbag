package com.kitbag.corenative.transport

import com.kitbag.corenative.transport.TransportAction.NEXT
import com.kitbag.corenative.transport.TransportAction.PAUSE
import com.kitbag.corenative.transport.TransportAction.PLAY
import com.kitbag.corenative.transport.TransportAction.PREVIOUS
import com.kitbag.corenative.transport.TransportAction.STOP
import com.kitbag.corenative.transport.TransportAction.TEMPO_DOWN
import com.kitbag.corenative.transport.TransportAction.TEMPO_UP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TransportModelTest {
  private val model = TransportModel(minBpm = 20.0, maxBpm = 400.0)
  private val none = emptyList<TransportCommand>()

  private fun state(
    playback: Playback = Playback.PLAYING,
    bpm: Double = 120.0,
    rampRunning: Boolean = false,
    setlist: SetlistPosition? = null,
  ) = TransportState(playback, bpm, rampRunning, beatsPerBar = 4, beatUnit = 4, setlist = setlist)

  private fun song(index: Int) = SetlistPosition("Wedding set", "Blackbird", index, songCount = 12)

  @Test
  fun `title is tempo and signature, subtitle follows the design's set, song and position`() {
    val view = model.view(state(bpm = 119.6, setlist = song(2)))
    assertEquals("120 BPM · 4/4", view.title)
    assertEquals("Wedding set · Blackbird (3/12)", view.subtitle)
  }

  @Test
  fun `no setlist means no subtitle and no previous or next`() {
    val view = model.view(state())
    assertNull(view.subtitle)
    assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP, STOP), view.actions)
  }

  @Test
  fun `first, middle and last song emit only the neighbours that exist`() {
    assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP, NEXT, STOP), model.view(state(setlist = song(0))).actions)
    assertEquals(
      listOf(PREVIOUS, TEMPO_DOWN, PAUSE, TEMPO_UP, NEXT, STOP),
      model.view(state(setlist = song(5))).actions,
    )
    assertEquals(listOf(PREVIOUS, TEMPO_DOWN, PAUSE, TEMPO_UP, STOP), model.view(state(setlist = song(11))).actions)
  }

  @Test
  fun `compact view is tempo down, play or pause, tempo up`() {
    assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP), model.view(state()).compactActions)
    assertEquals(listOf(TEMPO_DOWN, PLAY, TEMPO_UP), model.view(state(Playback.PAUSED)).compactActions)
  }

  @Test
  fun `system media controls drop both tempo keys only when both neighbours show`() {
    assertEquals(listOf(PREVIOUS, PAUSE, NEXT, STOP), model.view(state(setlist = song(5))).sessionActions)
    assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP, NEXT, STOP), model.view(state(setlist = song(0))).sessionActions)
    assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP, STOP), model.view(state()).sessionActions)
  }

  @Test
  fun `stopped shows play and no stop`() {
    assertEquals(listOf(TEMPO_DOWN, PLAY, TEMPO_UP), model.view(state(Playback.STOPPED)).actions)
  }

  @Test
  fun `play emits start when stopped and resume when paused`() {
    assertEquals(listOf(TransportCommand.Start), model.commandsFor(state(Playback.STOPPED), PLAY))
    assertEquals(listOf(TransportCommand.Resume), model.commandsFor(state(Playback.PAUSED), PLAY))
  }

  @Test
  fun `a repeated play, pause or stop changes nothing the second time`() {
    assertEquals(none, model.commandsFor(state(Playback.PLAYING), PLAY))
    assertEquals(none, model.commandsFor(state(Playback.PAUSED), PAUSE))
    assertEquals(none, model.commandsFor(state(Playback.STOPPED), STOP))
    assertEquals(listOf(TransportCommand.Pause), model.commandsFor(state(Playback.PLAYING), PAUSE))
    assertEquals(listOf(TransportCommand.Stop), model.commandsFor(state(Playback.PAUSED), STOP))
  }

  @Test
  fun `tempo steps by one from the rounded effective tempo, like the screen keys`() {
    assertEquals(listOf(TransportCommand.SetTempo(119.0)), model.commandsFor(state(bpm = 120.0), TEMPO_DOWN))
    assertEquals(listOf(TransportCommand.SetTempo(125.0)), model.commandsFor(state(bpm = 123.5), TEMPO_UP))
    assertEquals(listOf(TransportCommand.SetTempo(400.0)), model.commandsFor(state(bpm = 399.4), TEMPO_UP))
  }

  @Test
  fun `tempo at a bound does nothing, unless a ramp is running, which it cancels`() {
    assertEquals(none, model.commandsFor(state(bpm = 20.0), TEMPO_DOWN))
    assertEquals(
      listOf(TransportCommand.SetTempo(20.0)),
      model.commandsFor(state(bpm = 20.0, rampRunning = true), TEMPO_DOWN),
    )
  }

  @Test
  fun `previous and next are relative and do nothing past either end`() {
    assertEquals(listOf(TransportCommand.PreviousSong), model.commandsFor(state(setlist = song(5)), PREVIOUS))
    assertEquals(listOf(TransportCommand.NextSong), model.commandsFor(state(setlist = song(5)), NEXT))
    assertEquals(none, model.commandsFor(state(setlist = song(0)), PREVIOUS))
    assertEquals(none, model.commandsFor(state(setlist = song(11)), NEXT))
    assertEquals(none, model.commandsFor(state(), NEXT))
  }

  @Test
  fun `detail line shows played time, after the set and song when there is one`() {
    assertEquals("0:07", model.detail(null, 7_900))
    assertEquals("12:05", model.detail(null, 725_000))
    assertEquals("1:02:03", model.detail(null, 3_723_000))
    assertEquals("Wedding set · Blackbird (3/12) · 0:42", model.detail("Wedding set · Blackbird (3/12)", 42_000))
  }

  @Test(expected = IllegalArgumentException::class)
  fun `a position outside its setlist is rejected`() {
    song(12)
  }
}
