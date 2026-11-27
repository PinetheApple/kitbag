package com.kitbag.corenative

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import androidx.media.AudioAttributesCompat
import androidx.media.AudioFocusRequestCompat
import androidx.media.AudioManagerCompat
import com.kitbag.corenative.transport.FocusCall
import com.kitbag.corenative.transport.FocusHold
import com.kitbag.corenative.transport.Interruption

internal class SongFocus(context: Context, private val onLoss: (Interruption) -> Unit) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private val hold = FocusHold()

  private val request = AudioFocusRequestCompat.Builder(AudioManagerCompat.AUDIOFOCUS_GAIN)
    .setAudioAttributes(MEDIA)
    // The system ducks media focus itself on API 26+; below that a duck is ignored.
    .setWillPauseWhenDucked(false)
    .setOnAudioFocusChangeListener({ change -> hold.changed(change)?.let(onLoss) }, handler)
    .build()

  fun follow(playing: Boolean) {
    when (hold.follow(playing)) {
      FocusCall.REQUEST -> refused(AudioManagerCompat.requestAudioFocus(audio, request))
      FocusCall.ABANDON -> AudioManagerCompat.abandonAudioFocusRequest(audio, request)
      FocusCall.NONE -> Unit
    }
  }

  // The request runs inside the song card's refresh, so its pause waits for that refresh to finish.
  private fun refused(result: Int) {
    hold.requested(result)?.let { handler.post { onLoss(it) } }
  }

  private companion object {
    val MEDIA: AudioAttributesCompat = AudioAttributesCompat.Builder()
      .setUsage(AudioAttributesCompat.USAGE_MEDIA)
      .setContentType(AudioAttributesCompat.CONTENT_TYPE_MUSIC)
      .build()
  }
}
