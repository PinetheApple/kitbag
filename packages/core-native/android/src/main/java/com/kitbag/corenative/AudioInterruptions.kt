package com.kitbag.corenative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import com.kitbag.corenative.transport.CallWatch
import com.kitbag.corenative.transport.Interruption
import java.util.concurrent.Executor

internal class AudioInterruptions(
  private val context: Context,
  private val playing: () -> Boolean,
  private val onInterruption: (Interruption) -> Unit,
) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private var calls = CallWatch(audio.mode)
  private var modeChanges: ModeChanges? = null
  private var polling = false

  private val noisy = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = onInterruption(Interruption.OUTPUT_LOST)
  }

  private val pollMode = Runnable {
    onMode(audio.mode)
    polling = playing()
    if (polling) schedulePoll()
  }

  fun start() {
    ContextCompat.registerReceiver(
      context,
      noisy,
      IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      modeChanges = ModeChanges(audio, ContextCompat.getMainExecutor(context), ::onMode).also { it.add() }
    }
  }

  fun playbackChanged() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S || polling || !playing()) return
    polling = true
    calls = CallWatch(audio.mode)
    schedulePoll()
  }

  fun stop() {
    context.unregisterReceiver(noisy)
    handler.removeCallbacks(pollMode)
    polling = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) modeChanges?.remove()
    modeChanges = null
  }

  private fun onMode(mode: Int) {
    if (calls.began(mode)) onInterruption(Interruption.CALL)
  }

  private fun schedulePoll() {
    handler.postDelayed(pollMode, MODE_POLL_MILLIS)
  }

  @RequiresApi(Build.VERSION_CODES.S)
  private class ModeChanges(
    private val audio: AudioManager,
    private val executor: Executor,
    onMode: (Int) -> Unit,
  ) {
    private val listener = AudioManager.OnModeChangedListener(onMode)

    fun add() = audio.addOnModeChangedListener(executor, listener)

    fun remove() = audio.removeOnModeChangedListener(listener)
  }

  private companion object {
    const val MODE_POLL_MILLIS = 1_000L
  }
}
