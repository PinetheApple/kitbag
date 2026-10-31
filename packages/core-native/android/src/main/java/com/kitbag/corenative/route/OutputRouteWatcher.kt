package com.kitbag.corenative.route

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

class OutputRouteWatcher(
  context: Context,
  private val engineDeviceId: () -> Int,
  private val onChange: (OutputRoute) -> Unit,
) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private val knownSinks = mutableSetOf<Int>()
  private var settle: RouteSettle? = null

  @Volatile
  private var lastAdded: Int? = null

  private val read = Runnable {
    val active = settle ?: return@Runnable
    active.onRead(current())?.let(onChange)
    reschedule(active)
  }

  private val devices = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<AudioDeviceInfo>) {
      val fresh = added.filter { it.isSink && knownSinks.add(it.id) }
      if (fresh.isEmpty()) return
      OutputRoutes.preferred(fresh.map(::sinkOf))?.let { lastAdded = it.handle }
      triggerNow()
    }

    override fun onAudioDevicesRemoved(removed: Array<AudioDeviceInfo>) {
      val gone = removed.filter { it.isSink && knownSinks.remove(it.id) }.map { it.id }
      if (gone.isEmpty()) return
      if (lastAdded in gone) lastAdded = null
      triggerNow()
    }
  }

  fun start() {
    handler.post {
      knownSinks += outputs().map { it.id }
      settle = RouteSettle(current())
      audio.registerAudioDeviceCallback(devices, handler)
    }
  }

  fun stop() {
    handler.removeCallbacksAndMessages(null)
    handler.post {
      audio.unregisterAudioDeviceCallback(devices)
      settle = null
    }
  }

  fun trigger() {
    handler.post(::triggerNow)
  }

  fun current(): OutputRoute =
    OutputRoutes.resolve(
      engineDeviceId().takeIf { it >= 0 },
      outputs().map(::sinkOf),
      policySink(),
      lastAdded,
      Build.MODEL,
    )

  private fun triggerNow() {
    val active = settle ?: return
    active.trigger(SystemClock.uptimeMillis())
    reschedule(active)
  }

  private fun reschedule(active: RouteSettle) {
    handler.removeCallbacks(read)
    active.pendingReadAt?.let { handler.postAtTime(read, it) }
  }

  private fun outputs(): List<AudioDeviceInfo> =
    audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).toList()

  private fun policySink(): SinkDevice? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return null
    return audio.getAudioDevicesForAttributes(MEDIA).firstOrNull()?.let(::sinkOf)
  }

  private fun sinkOf(info: AudioDeviceInfo) =
    SinkDevice(
      handle = info.id,
      type = info.type,
      productName = info.productName?.toString().orEmpty(),
      address = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.address else null,
    )

  private companion object {
    val MEDIA: AudioAttributes =
      AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build()
  }
}
