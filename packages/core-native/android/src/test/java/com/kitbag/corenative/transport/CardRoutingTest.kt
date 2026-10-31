package com.kitbag.corenative.transport

import org.junit.Assert.assertEquals
import org.junit.Test

class CardRoutingTest {
  private val routing = CardRouting()

  private fun press(button: SessionButton) = routing.on(CardEvent.SessionPressed(button))

  private fun showMetronome() {
    routing.on(CardEvent.MetronomeShown)
  }

  private fun showSong() {
    routing.on(CardEvent.SongShown)
  }

  private fun assertSongShowing() {
    assertEquals(CardEffect.HoldMetronome, routing.on(CardEvent.MetronomeShown))
  }

  private fun assertNoSongShowing() {
    assertEquals(CardEffect.ShowMetronome, routing.on(CardEvent.MetronomeShown))
  }

  private fun assertNoCard() {
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeTapped(TransportAction.PLAY.name)))
  }

  @Test
  fun `the metronome's taps and hide leave the song card alone while a song shows`() {
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
  fun `a song stop returns to the metronome card when the metronome showed before the song`() {
    showMetronome()
    showSong()
    assertEquals(CardEffect.ReturnToMetronome, routing.on(CardEvent.SongStopped))
    assertEquals(CardEffect.MetronomeControl(TransportAction.PAUSE), press(SessionButton.PAUSE))
  }

  @Test
  fun `a metronome shown behind a song returns when the song is hidden`() {
    showSong()
    assertEquals(CardEffect.HoldMetronome, routing.on(CardEvent.MetronomeShown))
    assertEquals(CardEffect.ReturnToMetronome, routing.on(CardEvent.SongHidden))
  }

  @Test
  fun `a metronome hidden behind a song does not return when the song ends`() {
    showMetronome()
    showSong()
    routing.on(CardEvent.MetronomeHidden)
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongStopped))
    assertNoCard()
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
    showMetronome()
    assertEquals(CardEffect.MetronomeControl(TransportAction.PLAY), press(SessionButton.PLAY))
    assertEquals(CardEffect.MetronomeControl(TransportAction.PAUSE), press(SessionButton.PAUSE))
    assertEquals(CardEffect.None, routing.on(CardEvent.SessionSeeked(SEEK_MILLIS)))
  }

  @Test
  fun `skips reach only the metronome, rewind and fast forward only the song`() {
    showMetronome()
    assertEquals(CardEffect.MetronomeControl(TransportAction.NEXT), press(SessionButton.NEXT))
    assertEquals(CardEffect.None, press(SessionButton.REWIND))
    showSong()
    assertEquals(CardEffect.None, press(SessionButton.PREVIOUS))
    assertEquals(CardEffect.SongControl(SongAction.FORWARD), press(SessionButton.FAST_FORWARD))
  }

  @Test
  fun `custom actions and taps are read as the active card's actions`() {
    showMetronome()
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
  fun `song hide ends a showing song and otherwise stops a service with no card`() {
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.SongHidden))
    showSong()
    assertEquals(CardEffect.EndSong, routing.on(CardEvent.SongHidden))
    assertNoSongShowing()
  }

  @Test
  fun `a song tap with no song showing leaves the metronome card`() {
    showMetronome()
    assertEquals(CardEffect.None, routing.on(CardEvent.SongTapped(SongAction.PLAY.name)))
    assertEquals(CardEffect.None, routing.on(CardEvent.SongStopped))
    assertEquals(CardEffect.MetronomeControl(TransportAction.PAUSE), press(SessionButton.PAUSE))
  }

  @Test
  fun `the metronome stopping or hiding removes its card`() {
    showMetronome()
    assertEquals(
      CardEffect.MetronomeControl(TransportAction.STOP),
      routing.on(CardEvent.MetronomeTapped(TransportAction.STOP.name)),
    )
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeStopped))
    showMetronome()
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeHidden))
  }

  @Test
  fun `a late metronome tap or session press after its card is removed stops the service instead`() {
    showMetronome()
    routing.on(CardEvent.MetronomeHidden)
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.MetronomeTapped(TransportAction.PLAY.name)))
    assertEquals(CardEffect.RemoveCard, press(SessionButton.PLAY))
    assertEquals(
      CardEffect.RemoveCard,
      routing.on(CardEvent.SessionCustomPressed(TransportAction.TEMPO_UP.name)),
    )
  }

  @Test
  fun `a service started by a stale action with no card stops itself`() {
    assertNoCard()
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.SongTapped(SongAction.PLAY.name)))
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.SongStopped))
  }

  @Test
  fun `an unrecognised start keeps the showing card and its routing`() {
    showSong()
    assertEquals(CardEffect.None, routing.on(CardEvent.StartUnrecognised))
    assertSongShowing()
  }

  @Test
  fun `an unrecognised start with no card stops the service`() {
    assertEquals(CardEffect.RemoveCard, routing.on(CardEvent.StartUnrecognised))
    assertNoSongShowing()
  }

  private companion object {
    const val SEEK_MILLIS = 42_000L
  }
}
