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
  private val engineDeviceId: () -> Int?,
  private val onChange: (OutputRoute) -> Unit,
) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private val knownSinks = KnownSinks()
  private val enginePoll = EnginePoll()
  private var settle: RouteSettle? = null

  private val read = Runnable {
    val active = settle ?: return@Runnable
    active.onRead(current())?.let(onChange)
    reschedule(active)
  }

  private val poll = Runnable {
    if (enginePoll.onPoll(SystemClock.uptimeMillis(), engineDeviceId())) triggerNow()
    reschedulePoll()
  }

  private val devices = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<AudioDeviceInfo>) {
      if (knownSinks.added(sinksOf(added))) triggerNow()
    }

    override fun onAudioDevicesRemoved(removed: Array<AudioDeviceInfo>) {
      if (knownSinks.removed(sinksOf(removed))) triggerNow()
    }
  }

  fun start() {
    handler.post {
      knownSinks.seed(outputs().map(::sinkOf))
      settle = RouteSettle(current())
      audio.registerAudioDeviceCallback(devices, handler)
      startPoll()
    }
  }

  fun stop() {
    handler.removeCallbacksAndMessages(null)
    handler.post {
      audio.unregisterAudioDeviceCallback(devices)
      settle = null
      enginePoll.stop()
      handler.removeCallbacks(read)
      handler.removeCallbacks(poll)
    }
  }

  fun engineStarted() {
    handler.post {
      triggerNow()
      startPoll()
    }
  }

  fun report(deliver: (OutputRoute) -> Unit) {
    handler.post {
      val route = current()
      settle?.observe(route)?.let(onChange)
      deliver(route)
    }
  }

  private fun current(): OutputRoute =
    OutputRoutes.resolve(
      engineDeviceId(),
      outputs().map(::sinkOf),
      policySink(),
      knownSinks.lastAdded,
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

  private fun startPoll() {
    if (settle == null) return
    enginePoll.start(SystemClock.uptimeMillis(), engineDeviceId())
    reschedulePoll()
  }

  private fun reschedulePoll() {
    handler.removeCallbacks(poll)
    enginePoll.nextPollAt?.let { handler.postAtTime(poll, it) }
  }

  private fun sinksOf(devices: Array<AudioDeviceInfo>): List<SinkDevice> =
    devices.filter { it.isSink }.map(::sinkOf)

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
