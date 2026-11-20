package com.kitbag.corenative.transport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CardPosterTest {
  private class FakeSurface : CardSurface<String> {
    var shown: String? = null
    var foreground = false
    var promotions = 0
    var refusal: Throwable? = null
    var afterRemove: (() -> Unit)? = null

    override fun promote(notification: String): Throwable? {
      refusal?.let { return it }
      promotions += 1
      shown = notification
      foreground = true
      return null
    }

    override fun notify(notification: String) {
      shown = notification
    }

    override fun remove() {
      shown = null
      foreground = false
      afterRemove?.also { afterRemove = null }?.invoke()
    }
  }

  private val surface = FakeSurface()
  private val warnings = mutableListOf<Throwable>()
  private val poster = CardPoster(surface) { warnings += it }
  private val fences = CardFences()

  @Test
  fun `a paused card stays in the foreground and stays shown`() {
    val card = fences.song.issue()
    poster.post(PLAYING, true, fences.song, card)
    poster.post(PAUSED, false, fences.song, card)
    assertTrue(surface.foreground)
    assertEquals(2, surface.promotions)
    assertEquals(PAUSED, surface.shown)
  }

  @Test
  fun `a fresh service's first paused post promotes and stays in the foreground`() {
    poster.post(PAUSED, false, fences.song, fences.song.issue())
    assertEquals(1, surface.promotions)
    assertTrue(surface.foreground)
    assertEquals(PAUSED, surface.shown)
  }

  @Test
  fun `playing after paused keeps the card in the foreground`() {
    val card = fences.song.issue()
    poster.post(PAUSED, false, fences.song, card)
    poster.post(PLAYING, true, fences.song, card)
    assertTrue(surface.foreground)
    assertEquals(2, surface.promotions)
    assertEquals(PLAYING, surface.shown)
  }

  @Test
  fun `a stale playing post does not overwrite the paused card`() {
    val older = fences.song.issue()
    poster.post(PLAYING, true, fences.song, older)
    val current = fences.song.issue()
    poster.post(PAUSED, false, fences.song, current)
    poster.post(LATE, true, fences.song, older)
    assertEquals(PAUSED, surface.shown)
    assertTrue(surface.foreground)
  }

  @Test
  fun `a late paused post after finish shows nothing`() {
    val card = fences.song.issue()
    poster.post(PAUSED, false, fences.song, card)
    poster.finish()
    poster.post(LATE, false, fences.song, card)
    assertNull(surface.shown)
  }

  @Test
  fun `a paused post racing the cancel shows nothing`() {
    val card = fences.song.issue()
    poster.post(PAUSED, false, fences.song, card)
    surface.afterRemove = { poster.post(LATE, false, fences.song, card) }
    poster.finish()
    assertNull(surface.shown)
  }

  @Test
  fun `finish leaves a newer card the app already issued`() {
    poster.post(PAUSED, false, fences.song, fences.song.issue())
    val newer = fences.song.issue()
    poster.finish()
    poster.post(PLAYING, true, fences.song, newer)
    assertEquals(PLAYING, surface.shown)
  }

  @Test
  fun `finish takes a paused card out of the foreground and leaves nothing shown`() {
    val card = fences.song.issue()
    poster.post(PLAYING, true, fences.song, card)
    poster.post(PAUSED, false, fences.song, card)
    poster.finish()
    assertNull(surface.shown)
    assertFalse(surface.foreground)
  }

  @Test
  fun `a late paused metronome post after finish shows nothing`() {
    val card = fences.metronome.keep()
    poster.post(PAUSED, false, fences.metronome, card)
    poster.finish()
    poster.post(LATE, false, fences.metronome, card)
    assertNull(surface.shown)
  }

  @Test
  fun `a playing post after a refused promotion tries the foreground again`() {
    val card = fences.song.issue()
    surface.refusal = IllegalStateException(REFUSED)
    poster.post(PLAYING, true, fences.song, card)
    surface.refusal = null
    poster.post(PLAYING, true, fences.song, card)
    assertTrue(surface.foreground)
    assertEquals(1, surface.promotions)
  }

  @Test
  fun `a withdrawn card on a fresh service promotes and is removed at once`() {
    val card = fences.song.issue()
    fences.song.withdraw()
    poster.post(PLAYING, true, fences.song, card)
    assertEquals(1, surface.promotions)
    assertNull(surface.shown)
  }

  @Test
  fun `a refused promotion while playing falls back to a notification and warns`() {
    val refusal = IllegalStateException(REFUSED)
    surface.refusal = refusal
    poster.post(PLAYING, true, fences.song, fences.song.issue())
    assertEquals(PLAYING, surface.shown)
    assertEquals(listOf(refusal), warnings)
  }

  @Test
  fun `a refused promotion while paused falls back to a notification quietly`() {
    surface.refusal = IllegalStateException(REFUSED)
    poster.post(PAUSED, false, fences.song, fences.song.issue())
    assertEquals(PAUSED, surface.shown)
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `the metronome card stays in the foreground while playing and while paused`() {
    val card = fences.metronome.keep()
    poster.post(PLAYING, true, fences.metronome, card)
    assertTrue(surface.foreground)
    poster.post(PAUSED, false, fences.metronome, card)
    assertTrue(surface.foreground)
    assertEquals(PAUSED, surface.shown)
  }

  @Test
  fun `a stale paused metronome post does not cover the song that took over`() {
    val metronome = fences.showMetronome()
    poster.post(PAUSED, false, fences.metronome, metronome)
    fences.hideMetronome {}
    poster.post(PLAYING, true, fences.song, fences.song.issue())
    poster.post(LATE, false, fences.metronome, metronome)
    assertEquals(PLAYING, surface.shown)
    assertTrue(surface.foreground)
  }

  @Test
  fun `a hide for an older metronome card landing after a newer show leaves the newer card posting`() {
    val older = fences.showMetronome()
    poster.post(PAUSED, false, fences.metronome, older)
    fences.hideMetronome {}
    val newer = fences.showMetronome()
    poster.finish()
    poster.post(PLAYING, true, fences.metronome, newer)
    assertEquals(PLAYING, surface.shown)
  }

  @Test
  fun `a stale metronome post after a refused song promotion leaves the song card shown`() {
    val stale = fences.showMetronome()
    fences.hideMetronome {}
    surface.refusal = IllegalStateException(REFUSED)
    poster.post(PLAYING, true, fences.song, fences.song.issue())
    surface.refusal = null
    poster.post(LATE, false, fences.metronome, stale)
    assertEquals(PLAYING, surface.shown)
  }

  @Test
  fun `a foreground start still queued after finish promotes again`() {
    val card = fences.song.issue()
    poster.post(PLAYING, true, fences.song, card)
    poster.finish()
    poster.post(LATE, true, fences.song, card)
    assertEquals(2, surface.promotions)
    assertNull(surface.shown)
  }

  private companion object {
    const val PLAYING = "playing"
    const val PAUSED = "paused"
    const val LATE = "late"
    const val REFUSED = "refused"
  }
}
