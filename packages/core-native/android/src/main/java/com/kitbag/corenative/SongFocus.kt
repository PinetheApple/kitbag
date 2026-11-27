package com.kitbag.corenative

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import androidx.media.AudioAttributesCompat
import androidx.media.AudioFocusRequestCompat
import androidx.media.AudioManagerCompat
import com.kitbag.corenative.transport.Interruption
import com.kitbag.corenative.transport.InterruptionRouting

internal class SongFocus(context: Context, onLoss: (Interruption) -> Unit) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private var held = false

  private val request = AudioFocusRequestCompat.Builder(AudioManagerCompat.AUDIOFOCUS_GAIN)
    .setAudioAttributes(MEDIA)
    .setWillPauseWhenDucked(false)
    .setOnAudioFocusChangeListener(
      { change -> InterruptionRouting.ofFocusChange(change)?.let(onLoss) },
      Handler(Looper.getMainLooper()),
    )
    .build()

  fun hold(playing: Boolean) = if (playing) acquire() else release()

  fun release() {
    if (!held) return
    held = false
    AudioManagerCompat.abandonAudioFocusRequest(audio, request)
  }

  private fun acquire() {
    if (held) return
    held = AudioManagerCompat.requestAudioFocus(audio, request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  private companion object {
    val MEDIA: AudioAttributesCompat = AudioAttributesCompat.Builder()
      .setUsage(AudioAttributesCompat.USAGE_MEDIA)
      .setContentType(AudioAttributesCompat.CONTENT_TYPE_MUSIC)
      .build()
  }
}
