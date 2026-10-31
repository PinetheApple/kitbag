package com.kitbag.corenative.route

import android.media.AudioDeviceInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OutputRoutesTest {
  private fun sink(
    type: Int,
    name: String = "Buds",
    address: String? = null,
    handle: Int = 1,
  ) = SinkDevice(handle, type, name, address)

  private fun idOf(sink: SinkDevice) = OutputRoutes.routeOf(sink, MODEL, certain = true).id

  @Test
  fun `every listed type maps to its kind and an unknown type is other`() {
    val expected = mapOf(
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER to RouteKind.SPEAKER,
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE to RouteKind.SPEAKER,
      AudioDeviceInfo.TYPE_WIRED_HEADSET to RouteKind.WIRED,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES to RouteKind.WIRED,
      AudioDeviceInfo.TYPE_LINE_ANALOG to RouteKind.WIRED,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO to RouteKind.BLUETOOTH,
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP to RouteKind.BLUETOOTH,
      AudioDeviceInfo.TYPE_HEARING_AID to RouteKind.BLUETOOTH,
      AudioDeviceInfo.TYPE_BLE_HEADSET to RouteKind.BLUETOOTH,
      AudioDeviceInfo.TYPE_BLE_SPEAKER to RouteKind.BLUETOOTH,
      AudioDeviceInfo.TYPE_BLE_BROADCAST to RouteKind.BLUETOOTH,
      OutputRoutes.TYPE_BLE_HEARING_AID to RouteKind.BLUETOOTH,
      AudioDeviceInfo.TYPE_USB_DEVICE to RouteKind.USB,
      AudioDeviceInfo.TYPE_USB_ACCESSORY to RouteKind.USB,
      AudioDeviceInfo.TYPE_USB_HEADSET to RouteKind.USB,
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_HDMI to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_HDMI_ARC to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_HDMI_EARC to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_DOCK to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_DOCK_ANALOG to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_LINE_DIGITAL to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_AUX_LINE to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_IP to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_BUS to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_REMOTE_SUBMIX to RouteKind.OTHER,
      AudioDeviceInfo.TYPE_MULTICHANNEL_GROUP to RouteKind.OTHER,
      UNKNOWN_TYPE to RouteKind.OTHER,
    )
    expected.forEach { (type, kind) -> assertEquals("type $type", kind, OutputRoutes.kindOf(type)) }
  }

  @Test
  fun `the kinds on the wire are the TS spec union`() {
    assertEquals(
      listOf("speaker", "wired", "bluetooth", "usb", "other"),
      RouteKind.entries.map { it.wire },
    )
  }

  @Test
  fun `both speaker types share one id whatever the port name`() {
    assertEquals("speaker", idOf(sink(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, name = "Speaker")))
    assertEquals("speaker", idOf(sink(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE, name = MODEL)))
  }

  @Test
  fun `the jack is one route with or without a mic`() {
    val ids = listOf(
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_LINE_ANALOG,
    ).map { idOf(sink(it, name = "h2w-$it")) }
    assertEquals(listOf("wired", "wired", "wired"), ids)
  }

  @Test
  fun `a full, an anonymized and a lowercase address of one headset give one id`() {
    val ids = listOf("A1:B2:C3:D4:EE:FF", "XX:XX:XX:XX:EE:FF", "a1:b2:c3:d4:ee:ff")
      .map { idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, address = it)) }
      .toSet()
    assertEquals(setOf("bt-a2dp:EE:FF:Buds"), ids)
  }

  @Test
  fun `an A2DP headset with no address keeps an empty octet slot`() {
    assertEquals("bt-a2dp::Buds", idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, address = null)))
  }

  @Test
  fun `an address that is not a MAC adds no octets`() {
    assertEquals("bt-sco::Buds", idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_SCO, address = "card=1")))
  }

  @Test
  fun `an all-XX address adds no octets`() {
    val id = idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, address = "XX:XX:XX:XX:XX:XX"))
    assertEquals("bt-a2dp::Buds", id)
  }

  @Test
  fun `two same-name A2DP headsets differ by last octets and collide when those match`() {
    val a = idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, address = "00:11:22:33:44:55"))
    val b = idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, address = "00:11:22:33:44:56"))
    val c = idOf(sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, address = "99:11:22:33:44:55"))
    assertNotEquals(a, b)
    assertEquals(a, c)
  }

  @Test
  fun `LE Audio ignores which bud's address is active`() {
    val left = idOf(sink(AudioDeviceInfo.TYPE_BLE_HEADSET, address = "00:11:22:33:44:55"))
    val right = idOf(sink(AudioDeviceInfo.TYPE_BLE_HEADSET, address = "00:11:22:33:44:66"))
    assertEquals("bt-le:Buds", left)
    assertEquals(left, right)
  }

  @Test
  fun `a USB interface keeps its id across plug order`() {
    val first = idOf(sink(AudioDeviceInfo.TYPE_USB_HEADSET, name = "DAC", address = "card=1;device=0"))
    val second = idOf(sink(AudioDeviceInfo.TYPE_USB_HEADSET, name = "DAC", address = "card=2;device=0"))
    assertEquals("usb:DAC", first)
    assertEquals(first, second)
  }

  @Test
  fun `the remaining families key as the design table says`() {
    assertEquals("earpiece", idOf(sink(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE)))
    assertEquals("bt-le-broadcast", idOf(sink(AudioDeviceInfo.TYPE_BLE_BROADCAST, name = "Broadcast")))
    assertEquals("bt-hearing-aid:Buds", idOf(sink(OutputRoutes.TYPE_BLE_HEARING_AID, address = "00:11:22:33:44:55")))
    assertEquals("hdmi:TV", idOf(sink(AudioDeviceInfo.TYPE_HDMI_EARC, name = "TV")))
    assertEquals("dock:Buds", idOf(sink(AudioDeviceInfo.TYPE_DOCK_ANALOG)))
    assertEquals("other-$UNKNOWN_TYPE:Buds", idOf(sink(UNKNOWN_TYPE)))
  }

  @Test
  fun `a model-name fallback is an empty name except on a built-in`() {
    val usb = OutputRoutes.routeOf(sink(AudioDeviceInfo.TYPE_USB_DEVICE, name = " $MODEL "), MODEL, true)
    assertEquals("usb:", usb.id)
    assertEquals("", usb.name)
    val speaker = OutputRoutes.routeOf(sink(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, name = MODEL), MODEL, true)
    assertEquals(MODEL, speaker.name)
  }

  @Test
  fun `names are trimmed, whitespace-collapsed and NFC`() {
    val decomposed = "  Café \t Buds  "
    val route = OutputRoutes.routeOf(sink(AudioDeviceInfo.TYPE_BLE_HEADSET, name = decomposed), MODEL, true)
    assertEquals("Café Buds", route.name)
    assertEquals("bt-le:Café Buds", route.id)
  }

  @Test
  fun `the engine's device wins over the policy answer`() {
    val speaker = sink(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, handle = 2)
    val buds = sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, handle = 9)
    val route = OutputRoutes.resolve(9, listOf(speaker, buds), speaker, null, MODEL)
    assertEquals(RouteKind.BLUETOOTH, route.kind)
    assertTrue(route.certain)
  }

  @Test
  fun `a stale engine device falls to the policy answer`() {
    val speaker = sink(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, handle = 2)
    val wired = sink(AudioDeviceInfo.TYPE_WIRED_HEADPHONES, handle = 4)
    val route = OutputRoutes.resolve(77, listOf(speaker, wired), wired, 2, MODEL)
    assertEquals("wired", route.id)
    assertTrue(route.certain)
  }

  @Test
  fun `with neither engine nor policy the last added sink is an uncertain guess`() {
    val wired = sink(AudioDeviceInfo.TYPE_WIRED_HEADPHONES, handle = 4)
    val usb = sink(AudioDeviceInfo.TYPE_USB_HEADSET, name = "DAC", handle = 5)
    val route = OutputRoutes.resolve(null, listOf(wired, usb), null, 4, MODEL)
    assertEquals("wired", route.id)
    assertFalse(route.certain)
  }

  @Test
  fun `with no last added sink the fixed preference picks and skips SCO`() {
    val sinks = listOf(
      sink(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, handle = 2),
      sink(AudioDeviceInfo.TYPE_BLUETOOTH_SCO, handle = 3),
      sink(AudioDeviceInfo.TYPE_WIRED_HEADPHONES, handle = 4),
      sink(AudioDeviceInfo.TYPE_USB_HEADSET, name = "DAC", handle = 5),
    )
    assertEquals("usb:DAC", OutputRoutes.resolve(null, sinks, null, null, MODEL).id)
    assertEquals("usb:DAC", OutputRoutes.resolve(null, sinks, null, 99, MODEL).id)
  }

  @Test
  fun `nothing to go on is an uncertain speaker`() {
    val route = OutputRoutes.resolve(null, emptyList(), null, null, MODEL)
    assertEquals(OutputRoute("speaker", "", RouteKind.SPEAKER, certain = false), route)
  }

  @Test
  fun `the preferred newcomer in a connect burst is the media sink`() {
    val burst = listOf(
      sink(AudioDeviceInfo.TYPE_BLUETOOTH_SCO, handle = 3),
      sink(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, handle = 8),
    )
    assertEquals(8, OutputRoutes.preferred(burst)?.handle)
  }

  private companion object {
    const val MODEL = "SM-M156B"
    const val UNKNOWN_TYPE = 9_999
  }
}
