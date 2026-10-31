package com.kitbag.corenative.transport

import org.junit.Assert.assertEquals
import org.junit.Test

class CardRoutingTest {
  private val routing = CardRouting()

  private fun press(button: SessionButton) = routing.on(CardEvent.SessionPressed(button))

  private fun showSong() {
    routing.on(CardEvent.SongShown)
  }

  private fun assertSongShowing() {
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeShown))
  }

  private fun assertNoSongShowing() {
    assertEquals(CardEffect.ShowMetronome, routing.on(CardEvent.MetronomeShown))
  }

  @Test
  fun `the metronome's show, transport and hide are ignored while a song shows`() {
    showSong()
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeTapped(TransportAction.PAUSE.name)))
    assertEquals(CardEffect.None, routing.on(CardEvent.MetronomeHidden))
    assertSongShowing()
  }

  @Test
  fun `the click joined to the stems leaves the song card as the only card`() {
    assertEquals(CardEffect.ShowMetronome, routing.on(CardEvent.MetronomeShown))
    assertEquals(CardEffect.ShowSong, routing.on(CardEvent.SongShown))
    assertSongShowing()
  }

  @Test
  fun `a song stop currently ends the card even when the metronome showed before the song`() {
    routing.on(CardEvent.MetronomeShown)
    showSong()
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongStopped))
    assertNoSongShowing()
  }

  @Test
  fun `a session stop reaches the song, and the song stopping ends the song`() {
    showSong()
    assertEquals(CardEffect.SongControl(SongAction.STOP), press(SessionButton.STOP))
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongStopped))
    assertNoSongShowing()
  }

  @Test
  fun `session play, pause and seek go to the song while it shows`() {
    showSong()
    assertEquals(CardEffect.SongControl(SongAction.PLAY), press(SessionButton.PLAY))
    assertEquals(CardEffect.SongControl(SongAction.PAUSE), press(SessionButton.PAUSE))
    assertEquals(CardEffect.SeekSong(SEEK_MILLIS), routing.on(CardEvent.SessionSeeked(SEEK_MILLIS)))
  }

  @Test
  fun `session play and pause go to the metronome otherwise, and seek does nothing`() {
    routing.on(CardEvent.MetronomeShown)
    assertEquals(CardEffect.MetronomeControl(TransportAction.PLAY), press(SessionButton.PLAY))
    assertEquals(CardEffect.MetronomeControl(TransportAction.PAUSE), press(SessionButton.PAUSE))
    assertEquals(CardEffect.None, routing.on(CardEvent.SessionSeeked(SEEK_MILLIS)))
  }

  @Test
  fun `skips reach only the metronome, rewind and fast forward only the song`() {
    assertEquals(CardEffect.MetronomeControl(TransportAction.NEXT), press(SessionButton.NEXT))
    assertEquals(CardEffect.None, press(SessionButton.REWIND))
    showSong()
    assertEquals(CardEffect.None, press(SessionButton.PREVIOUS))
    assertEquals(CardEffect.SongControl(SongAction.FORWARD), press(SessionButton.FAST_FORWARD))
  }

  @Test
  fun `custom actions and taps are read as the active card's actions`() {
    assertEquals(
      CardEffect.MetronomeControl(TransportAction.TEMPO_UP),
      routing.on(CardEvent.SessionCustomPressed(TransportAction.TEMPO_UP.name)),
    )
    showSong()
    assertEquals(
      CardEffect.SongControl(SongAction.REWIND),
      routing.on(CardEvent.SessionCustomPressed(SongAction.REWIND.name)),
    )
    assertEquals(
      CardEffect.None,
      routing.on(CardEvent.SessionCustomPressed(TransportAction.TEMPO_UP.name)),
    )
    assertEquals(
      CardEffect.SongControl(SongAction.FORWARD),
      routing.on(CardEvent.SongTapped(SongAction.FORWARD.name)),
    )
    assertEquals(CardEffect.None, routing.on(CardEvent.SongTapped(null)))
  }

  @Test
  fun `song hide ends a showing song and is ignored otherwise`() {
    assertEquals(CardEffect.None, routing.on(CardEvent.SongHidden))
    showSong()
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongHidden))
    assertNoSongShowing()
  }

  @Test
  fun `a song tap with no song showing currently removes the metronome card`() {
    routing.on(CardEvent.MetronomeShown)
    assertEquals(
      CardEffect.RemoveCard,
      routing.on(CardEvent.SongTapped(SongAction.PLAY.name)),
    )
  }

  @Test
  fun `the metronome stopping or hiding removes its card`() {
    routing.on(CardEvent.MetronomeShown)
    assertEquals(
      CardEffect.MetronomeControl(TransportAction.STOP),
      routing.on(CardEvent.MetronomeTapped(TransportAction.STOP.name)),
    )
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeStopped))
    routing.on(CardEvent.MetronomeShown)
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeHidden))
  }

  @Test
  fun `an unrecognised start currently removes the card but keeps the song routing`() {
    showSong()
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.StartUnrecognised))
    assertSongShowing()
  }

  private companion object {
    const val SEEK_MILLIS = 42_000L
  }
}
