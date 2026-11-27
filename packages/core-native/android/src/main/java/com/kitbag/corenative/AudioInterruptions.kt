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
  private val onInterruption: (Interruption) -> Unit,
) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private val calls = CallWatch(audio.mode)
  private var modeChanges: ModeChanges? = null

  private val noisy = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) onInterruption(Interruption.OUTPUT_LOST)
    }
  }

  private val pollMode = Runnable {
    onMode(audio.mode)
    schedulePoll()
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
    } else {
      schedulePoll()
    }
  }

  fun stop() {
    context.unregisterReceiver(noisy)
    handler.removeCallbacks(pollMode)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) modeChanges?.remove()
    modeChanges = null
  }

  private fun onMode(mode: Int) {
    if (calls.began(mode)) onInterruption(Interruption.CALL)
  }

  // Below API 31 there is no mode callback; the mode, unlike telephony call state, also shows voice-chat calls.
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
