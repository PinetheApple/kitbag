package com.kitbag.corenative.transport

import org.junit.Assert.assertEquals
import org.junit.Test

class CardRoutingTest {
  private val routing = CardRouting()

  private fun press(button: SessionButton) = routing.on(CardEvent.SessionPress(button))

  private fun songShowing() {
    routing.on(CardEvent.SongShow)
  }

  @Test
  fun `the metronome's show, transport and hide are ignored while a song shows`() {
    songShowing()
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeShow))
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeTransport(TransportAction.PAUSE.name)))
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeHide))
    assertEquals(Card.SONG, routing.active)
  }

  @Test
  fun `the click joined to the stems leaves the song card as the only card`() {
    assertEquals(CardEffect.ShowMetronome, routing.on(CardEvent.MetronomeShow))
    assertEquals(CardEffect.ShowSong, routing.on(CardEvent.SongShow))
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeShow))
    assertEquals(Card.SONG, routing.active)
  }

  @Test
  fun `a song stop ends the card even when the metronome showed before the song`() {
    routing.on(CardEvent.MetronomeShow)
    routing.on(CardEvent.SongShow)
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongStopped))
    assertEquals(Card.NONE, routing.active)
    assertEquals(CardEffect.ShowMetronome, routing.on(CardEvent.MetronomeShow))
  }

  @Test
  fun `a song stop with nothing else showing removes the notification and stops the service`() {
    songShowing()
    assertEquals(CardEffect.SongControl(SongAction.STOP), press(SessionButton.STOP))
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongStopped))
    assertEquals(Card.NONE, routing.active)
  }

  @Test
  fun `session play, pause and seek go to the song while it shows`() {
    songShowing()
    assertEquals(CardEffect.SongControl(SongAction.PLAY), press(SessionButton.PLAY))
    assertEquals(CardEffect.SongControl(SongAction.PAUSE), press(SessionButton.PAUSE))
    assertEquals(CardEffect.SeekSong(SEEK_MILLIS), routing.on(CardEvent.SessionSeek(SEEK_MILLIS)))
  }

  @Test
  fun `session play and pause go to the metronome otherwise, and seek does nothing`() {
    routing.on(CardEvent.MetronomeShow)
    assertEquals(CardEffect.Metronome(TransportAction.PLAY), press(SessionButton.PLAY))
    assertEquals(CardEffect.Metronome(TransportAction.PAUSE), press(SessionButton.PAUSE))
    assertEquals(CardEffect.None, routing.on(CardEvent.SessionSeek(SEEK_MILLIS)))
  }

  @Test
  fun `skips reach only the metronome, rewind and fast forward only the song`() {
    assertEquals(CardEffect.Metronome(TransportAction.NEXT), press(SessionButton.NEXT))
    assertEquals(CardEffect.None, press(SessionButton.REWIND))
    songShowing()
    assertEquals(CardEffect.None, press(SessionButton.PREVIOUS))
    assertEquals(CardEffect.SongControl(SongAction.FORWARD), press(SessionButton.FAST_FORWARD))
  }

  @Test
  fun `custom actions and taps are read as the active card's actions`() {
    assertEquals(
      CardEffect.Metronome(TransportAction.TEMPO_UP),
      routing.on(CardEvent.SessionCustom(TransportAction.TEMPO_UP.name)),
    )
    songShowing()
    assertEquals(CardEffect.SongControl(SongAction.REWIND), routing.on(CardEvent.SessionCustom(SongAction.REWIND.name)))
    assertEquals(CardEffect.None, routing.on(CardEvent.SessionCustom(TransportAction.TEMPO_UP.name)))
    assertEquals(CardEffect.SongControl(SongAction.FORWARD), routing.on(CardEvent.SongTapped(SongAction.FORWARD.name)))
    assertEquals(CardEffect.None, routing.on(CardEvent.SongTapped(null)))
  }

  @Test
  fun `song hide ends a showing song and is ignored otherwise`() {
    assertEquals(CardEffect.None, routing.on(CardEvent.SongHide))
    songShowing()
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongHide))
    assertEquals(Card.NONE, routing.active)
  }

  @Test
  fun `a song tap with no song showing removes the card`() {
    routing.on(CardEvent.MetronomeShow)
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.SongTapped(SongAction.PLAY.name)))
    assertEquals(Card.NONE, routing.active)
  }

  @Test
  fun `the metronome stopping or hiding removes its card`() {
    routing.on(CardEvent.MetronomeShow)
    assertEquals(
      CardEffect.Metronome(TransportAction.STOP),
      routing.on(CardEvent.MetronomeTransport(TransportAction.STOP.name)),
    )
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeStopped))
    routing.on(CardEvent.MetronomeShow)
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeHide))
    assertEquals(Card.NONE, routing.active)
  }

  @Test
  fun `an unrecognised start removes the card without changing which card routes`() {
    songShowing()
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.Unrecognised))
    assertEquals(Card.SONG, routing.active)
  }

  private companion object {
    const val SEEK_MILLIS = 42_000L
  }
}
