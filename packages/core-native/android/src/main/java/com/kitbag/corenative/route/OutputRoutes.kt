package com.kitbag.corenative.route

import android.media.AudioDeviceInfo
import java.text.Normalizer

data class SinkDevice(val handle: Int, val type: Int, val productName: String, val address: String?)

enum class RouteKind {
  SPEAKER,
  WIRED,
  BLUETOOTH,
  USB,
  OTHER,
  ;

  val wire: String get() = name.lowercase()
}

data class OutputRoute(val id: String, val name: String, val kind: RouteKind, val certain: Boolean)

private enum class Keying { FIXED, NAMED, ADDRESSED }

private enum class Family(
  val prefix: String,
  val kind: RouteKind,
  val keying: Keying,
  val builtIn: Boolean,
  val types: Set<Int>,
) {
  SPEAKER(
    "speaker",
    RouteKind.SPEAKER,
    Keying.FIXED,
    builtIn = true,
    setOf(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE),
  ),
  EARPIECE(
    "earpiece",
    RouteKind.OTHER,
    Keying.FIXED,
    builtIn = true,
    setOf(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE),
  ),
  WIRED(
    "wired",
    RouteKind.WIRED,
    Keying.FIXED,
    builtIn = false,
    setOf(
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_LINE_ANALOG,
    ),
  ),
  USB(
    "usb",
    RouteKind.USB,
    Keying.NAMED,
    builtIn = false,
    setOf(
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_USB_ACCESSORY,
      AudioDeviceInfo.TYPE_USB_HEADSET,
    ),
  ),
  BT_A2DP(
    "bt-a2dp",
    RouteKind.BLUETOOTH,
    Keying.ADDRESSED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP),
  ),
  BT_SCO(
    "bt-sco",
    RouteKind.BLUETOOTH,
    Keying.ADDRESSED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_BLUETOOTH_SCO),
  ),
  BT_LE(
    "bt-le",
    RouteKind.BLUETOOTH,
    Keying.NAMED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_BLE_SPEAKER),
  ),
  BT_LE_BROADCAST(
    "bt-le-broadcast",
    RouteKind.BLUETOOTH,
    Keying.FIXED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_BLE_BROADCAST),
  ),
  HEARING_AID(
    "bt-hearing-aid",
    RouteKind.BLUETOOTH,
    Keying.NAMED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_HEARING_AID, OutputRoutes.TYPE_BLE_HEARING_AID),
  ),
  HDMI(
    "hdmi",
    RouteKind.OTHER,
    Keying.NAMED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_HDMI, AudioDeviceInfo.TYPE_HDMI_ARC, AudioDeviceInfo.TYPE_HDMI_EARC),
  ),
  DOCK(
    "dock",
    RouteKind.OTHER,
    Keying.NAMED,
    builtIn = false,
    setOf(AudioDeviceInfo.TYPE_DOCK, AudioDeviceInfo.TYPE_DOCK_ANALOG),
  ),
  ;

  companion object {
    fun of(type: Int): Family? = entries.firstOrNull { type in it.types }
  }
}

object OutputRoutes {
  // AudioDeviceInfo.TYPE_BLE_HEARING_AID is API 37, above compileSdk 36.
  const val TYPE_BLE_HEARING_AID = 33

  private const val OTHER_PREFIX = "other-"
  private val WHITESPACE = Regex("\\s+")
  private val MAC_LAST_TWO_OCTETS =
    Regex("^(?:(?:[0-9A-F]{2}|XX):){4}([0-9A-F]{2}:[0-9A-F]{2})$")
  private val MEDIA_PREFERENCE =
    listOf(RouteKind.BLUETOOTH, RouteKind.USB, RouteKind.WIRED, RouteKind.SPEAKER)
  private val SPEAKER_FALLBACK =
    OutputRoute(Family.SPEAKER.prefix, "", RouteKind.SPEAKER, certain = false)

  fun kindOf(type: Int): RouteKind = Family.of(type)?.kind ?: RouteKind.OTHER

  fun routeOf(sink: SinkDevice, deviceModel: String, certain: Boolean): OutputRoute {
    val family = Family.of(sink.type)
    val name = displayName(sink.productName, deviceModel, builtIn = family?.builtIn == true)
    val id = when (family?.keying) {
      null -> "$OTHER_PREFIX${sink.type}:$name"
      Keying.FIXED -> family.prefix
      Keying.NAMED -> "${family.prefix}:$name"
      Keying.ADDRESSED -> "${family.prefix}:${lastTwoOctets(sink.address)}:$name"
    }
    return OutputRoute(id, name, family?.kind ?: RouteKind.OTHER, certain)
  }

  fun resolve(
    engineHandle: Int?,
    sinks: List<SinkDevice>,
    policy: SinkDevice?,
    lastAdded: Int?,
    deviceModel: String,
  ): OutputRoute {
    val engine = sinks.firstOrNull { it.handle == engineHandle }
    val known = engine ?: policy
    if (known != null) return routeOf(known, deviceModel, certain = true)
    val guess =
      sinks.firstOrNull { it.handle == lastAdded && rank(it) != null } ?: preferred(sinks)
    return guess?.let { routeOf(it, deviceModel, certain = false) } ?: SPEAKER_FALLBACK
  }

  fun preferred(sinks: List<SinkDevice>): SinkDevice? =
    sinks.mapNotNull { sink -> rank(sink)?.let { it to sink } }.minByOrNull { it.first }?.second

  private fun rank(sink: SinkDevice): Int? {
    if (sink.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) return null
    return MEDIA_PREFERENCE.indexOf(kindOf(sink.type)).takeIf { it >= 0 }
  }

  private fun normalized(raw: String): String =
    Normalizer.normalize(raw, Normalizer.Form.NFC).trim().replace(WHITESPACE, " ")

  private fun displayName(raw: String, deviceModel: String, builtIn: Boolean): String {
    val name = normalized(raw)
    return if (!builtIn && name == normalized(deviceModel)) "" else name
  }

  private fun lastTwoOctets(address: String?): String {
    val mac = address?.trim()?.uppercase() ?: return ""
    return MAC_LAST_TWO_OCTETS.matchEntire(mac)?.groupValues?.get(1).orEmpty()
  }
}
