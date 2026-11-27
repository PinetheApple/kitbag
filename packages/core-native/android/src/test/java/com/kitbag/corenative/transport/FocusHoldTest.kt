package com.kitbag.corenative.transport

import android.media.AudioManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FocusHoldTest {
  private val hold = FocusHold()

  private fun play(result: Int = AudioManager.AUDIOFOCUS_REQUEST_GRANTED): Interruption? {
    assertEquals(FocusCall.REQUEST, hold.follow(playing = true))
    return hold.requested(result)
  }

  @Test
  fun `a granted request holds focus and pauses nothing`() {
    assertNull(play())
    assertTrue(hold.held)
    assertEquals(FocusCall.NONE, hold.follow(playing = true))
  }

  @Test
  fun `a refused request pauses the song and holds nothing`() {
    assertEquals(Interruption.FOCUS_LOST, play(AudioManager.AUDIOFOCUS_REQUEST_FAILED))
    assertFalse(hold.held)
    assertEquals(FocusCall.NONE, hold.follow(playing = false))
  }

  @Test
  fun `a pause abandons a held focus once`() {
    play()
    assertEquals(FocusCall.ABANDON, hold.follow(playing = false))
    assertEquals(FocusCall.NONE, hold.follow(playing = false))
  }

  @Test
  fun `after a permanent loss the next play asks again`() {
    play()
    assertEquals(Interruption.FOCUS_LOST, hold.changed(AudioManager.AUDIOFOCUS_LOSS))
    assertFalse(hold.held)
    assertEquals(FocusCall.NONE, hold.follow(playing = false))
    assertNull(play())
  }

  @Test
  fun `a transient loss keeps focus to abandon on the pause`() {
    play()
    assertEquals(Interruption.FOCUS_LOST, hold.changed(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT))
    assertEquals(FocusCall.ABANDON, hold.follow(playing = false))
  }

  @Test
  fun `a duck or a regain pauses nothing`() {
    play()
    assertNull(hold.changed(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK))
    assertNull(hold.changed(AudioManager.AUDIOFOCUS_GAIN))
    assertTrue(hold.held)
  }
}
