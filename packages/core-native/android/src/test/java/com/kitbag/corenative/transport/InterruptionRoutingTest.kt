package com.kitbag.corenative.transport

import android.media.AudioManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InterruptionRoutingTest {
  private val nothing = Pauses(song = false, metronome = false)
  private val songOnly = Pauses(song = true, metronome = false)
  private val metronomeOnly = Pauses(song = false, metronome = true)

  private fun playing(song: Boolean = false, metronome: Boolean = false, following: Boolean = false) =
    NowPlaying(song = song, metronome = metronome, playAlongFollowing = following)

  private fun pauses(interruption: Interruption, now: NowPlaying) = InterruptionRouting.pauses(interruption, now)

  @Test
  fun `every interruption pauses a playing song or stem song`() {
    Interruption.entries.forEach { assertEquals(it.name, songOnly, pauses(it, playing(song = true))) }
  }

  @Test
  fun `lost output and a call pause the metronome running alone`() {
    assertEquals(metronomeOnly, pauses(Interruption.OUTPUT_LOST, playing(metronome = true)))
    assertEquals(metronomeOnly, pauses(Interruption.CALL, playing(metronome = true)))
  }

  @Test
  fun `a focus loss leaves the metronome clicking, since it holds no focus`() {
    assertEquals(nothing, pauses(Interruption.FOCUS_LOST, playing(metronome = true)))
  }

  @Test
  fun `the Play along click keeps running through lost output and a call`() {
    Interruption.entries.forEach {
      assertEquals(it.name, nothing, pauses(it, playing(metronome = true, following = true)))
    }
  }

  @Test
  fun `a song still pauses while Play along follows`() {
    assertEquals(songOnly, pauses(Interruption.OUTPUT_LOST, playing(song = true, following = true)))
  }

  @Test
  fun `a click joined to a playing song is left to the song's pause`() {
    assertEquals(songOnly, pauses(Interruption.OUTPUT_LOST, playing(song = true, metronome = true)))
  }

  @Test
  fun `nothing playing pauses nothing`() {
    Interruption.entries.forEach { assertEquals(it.name, nothing, pauses(it, playing())) }
  }

  @Test
  fun `a permanent or transient focus loss is a focus loss`() {
    assertEquals(Interruption.FOCUS_LOST, InterruptionRouting.ofFocusChange(AudioManager.AUDIOFOCUS_LOSS))
    assertEquals(Interruption.FOCUS_LOST, InterruptionRouting.ofFocusChange(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT))
  }

  @Test
  fun `a duck or a regained focus interrupts nothing, so nothing resumes`() {
    assertNull(InterruptionRouting.ofFocusChange(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK))
    assertNull(InterruptionRouting.ofFocusChange(AudioManager.AUDIOFOCUS_GAIN))
  }
}
