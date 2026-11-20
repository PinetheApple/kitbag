package com.kitbag.corenative.transport

import com.kitbag.corenative.transport.TransportAction.PAUSE
import com.kitbag.corenative.transport.TransportAction.PLAY
import com.kitbag.corenative.transport.TransportAction.STOP
import com.kitbag.corenative.transport.TransportAction.TEMPO_DOWN
import com.kitbag.corenative.transport.TransportAction.TEMPO_UP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TransportModelTest {
  private val model = TransportModel(minBpm = 20.0, maxBpm = 400.0)
  private val none = emptyList<TransportCommand>()

  private fun state(
    playback: Playback = Playback.PLAYING,
    bpm: Double = 120.0,
    rampRunning: Boolean = false,
    subtitle: String? = null,
  ) = TransportState(playback, bpm, rampRunning, beatsPerBar = 4, beatUnit = 4, subtitle = subtitle)

  @Test
  fun `title is tempo and signature, subtitle is the text the app sent`() {
    val view = model.view(state(bpm = 119.6, subtitle = SUBTITLE))
    assertEquals("120 BPM · 4/4", view.title)
    assertEquals(SUBTITLE, view.subtitle)
  }

  @Test
  fun `no setlist means no subtitle`() {
    assertNull(model.view(state()).subtitle)
  }

  @Test
  fun `the card is tempo down, play or pause, tempo up and stop, with or without a setlist`() {
    for (subtitle in listOf(null, SUBTITLE)) {
      assertEquals(listOf(TEMPO_DOWN, PAUSE, TEMPO_UP, STOP), model.view(state(subtitle = subtitle)).actions)
      assertEquals(
        listOf(TEMPO_DOWN, PLAY, TEMPO_UP, STOP),
        model.view(state(Playback.PAUSED, subtitle = subtitle)).actions,
      )
    }
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
  fun `the step reported to the app is the one the tempo keys take, and none for the rest`() {
    for (action in listOf(TEMPO_UP, TEMPO_DOWN)) {
      val stepped = TransportCommand.SetTempo(120.0 + model.tempoStep(action))
      assertEquals(listOf(stepped), model.commandsFor(state(), action))
    }
    assertEquals(-model.tempoStep(TEMPO_UP), model.tempoStep(TEMPO_DOWN))
    for (action in listOf(PLAY, PAUSE, STOP)) assertEquals(0, model.tempoStep(action))
  }

  @Test
  fun `a card shown stopped ends only on stop`() {
    val stopped = state(Playback.STOPPED)
    assertTrue(model.endsCard(STOP, stopped))
    assertTrue(model.endsCard(STOP, state(Playback.STOPPED, bpm = 90.0)))
    for (action in listOf(TEMPO_DOWN, TEMPO_UP, PAUSE)) assertFalse(model.endsCard(action, stopped))
    assertFalse(model.endsCard(PLAY, state(Playback.PLAYING)))
  }

  @Test
  fun `the show flags read as one playback`() {
    assertEquals(Playback.PLAYING, playbackOf(playing = true, stopped = false))
    assertEquals(Playback.STOPPED, playbackOf(playing = false, stopped = true))
    assertEquals(Playback.PAUSED, playbackOf(playing = false, stopped = false))
  }

  @Test
  fun `named finds an action and ignores an unknown or retired name`() {
    assertEquals(TEMPO_UP, TransportAction.named("TEMPO_UP"))
    assertNull(TransportAction.named("REWIND"))
    assertNull(TransportAction.named("NEXT"))
    assertNull(TransportAction.named("PREVIOUS"))
  }

  private companion object {
    const val SUBTITLE = "Wedding set · Blackbird (3/12)"
  }
}
