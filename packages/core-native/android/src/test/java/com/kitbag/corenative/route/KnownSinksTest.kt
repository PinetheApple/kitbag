package com.kitbag.corenative.route

import android.media.AudioDeviceInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class KnownSinksTest {
  private val speaker = SinkDevice(1, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, "", null)
  private val a2dp = SinkDevice(2, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, "Buds", null)
  private val sco = SinkDevice(3, AudioDeviceInfo.TYPE_BLUETOOTH_SCO, "Buds", null)
  private val usb = SinkDevice(4, AudioDeviceInfo.TYPE_USB_HEADSET, "DAC", null)

  @Test
  fun `the registration delivery of the seeded set is not new`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker, a2dp))
    assertFalse(sinks.added(listOf(speaker, a2dp)))
    assertNull(sinks.lastAdded)
  }

  @Test
  fun `a genuinely new sink becomes the last added`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker))
    assertTrue(sinks.added(listOf(speaker, usb)))
    assertEquals(usb.handle, sinks.lastAdded)
  }

  @Test
  fun `a connect burst picks its media sink, not SCO`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker))
    assertTrue(sinks.added(listOf(sco, a2dp)))
    assertEquals(a2dp.handle, sinks.lastAdded)
  }

  @Test
  fun `a burst with only SCO new is a change that keeps the earlier last added`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker))
    sinks.added(listOf(usb))
    assertTrue(sinks.added(listOf(sco)))
    assertEquals(usb.handle, sinks.lastAdded)
  }

  @Test
  fun `removing the last added sink clears it`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker))
    sinks.added(listOf(usb))
    assertTrue(sinks.removed(listOf(usb)))
    assertNull(sinks.lastAdded)
  }

  @Test
  fun `removing another sink keeps the last added`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker, a2dp))
    sinks.added(listOf(usb))
    assertTrue(sinks.removed(listOf(a2dp)))
    assertEquals(usb.handle, sinks.lastAdded)
  }

  @Test
  fun `removing an unknown sink is no change`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker))
    assertFalse(sinks.removed(listOf(usb)))
  }

  @Test
  fun `a sink removed and re-added is new again`() {
    val sinks = KnownSinks()
    sinks.seed(listOf(speaker, usb))
    sinks.removed(listOf(usb))
    assertTrue(sinks.added(listOf(usb)))
    assertEquals(usb.handle, sinks.lastAdded)
  }
}
