package com.kitbag.corenative.transport

import android.media.AudioManager
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallWatchTest {
  @Test
  fun `a ringtone, a phone call or a voice call each begin a call`() {
    listOf(AudioManager.MODE_RINGTONE, AudioManager.MODE_IN_CALL, AudioManager.MODE_IN_COMMUNICATION).forEach {
      assertTrue("mode $it", CallWatch(AudioManager.MODE_NORMAL).began(it))
    }
  }

  @Test
  fun `answering a ringing call is the same call`() {
    val calls = CallWatch(AudioManager.MODE_NORMAL)
    assertTrue(calls.began(AudioManager.MODE_RINGTONE))
    assertFalse(calls.began(AudioManager.MODE_IN_CALL))
  }

  @Test
  fun `a call after the last one ended begins again`() {
    val calls = CallWatch(AudioManager.MODE_NORMAL)
    calls.began(AudioManager.MODE_IN_CALL)
    assertFalse(calls.began(AudioManager.MODE_NORMAL))
    assertTrue(calls.began(AudioManager.MODE_IN_CALL))
  }

  @Test
  fun `a call already under way when watching starts is not a new one`() {
    assertFalse(CallWatch(AudioManager.MODE_IN_CALL).began(AudioManager.MODE_IN_CALL))
  }

  @Test
  fun `an unchanged normal mode begins nothing`() {
    assertFalse(CallWatch(AudioManager.MODE_NORMAL).began(AudioManager.MODE_NORMAL))
  }
}
