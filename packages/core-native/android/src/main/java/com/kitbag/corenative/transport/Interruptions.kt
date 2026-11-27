package com.kitbag.corenative.transport

import android.media.AudioManager

enum class Interruption {
  OUTPUT_LOST,
  CALL,
  FOCUS_LOST,
}

data class NowPlaying(val song: Boolean, val metronome: Boolean, val playAlongFollowing: Boolean)

data class Pauses(val song: Boolean, val metronome: Boolean)

object InterruptionRouting {
  private val LONE_METRONOME_PAUSES = setOf(Interruption.OUTPUT_LOST, Interruption.CALL)

  // A click joined to a song stops with the song; Play along's click is the followed app's to stop.
  fun pauses(interruption: Interruption, playing: NowPlaying): Pauses =
    Pauses(
      song = playing.song,
      metronome = playing.metronome &&
        !playing.song &&
        !playing.playAlongFollowing &&
        interruption in LONE_METRONOME_PAUSES,
    )

  // Media focus is ducked by the system itself (API 26+), and a regained focus never resumes a pause.
  fun ofFocusChange(change: Int): Interruption? =
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> Interruption.FOCUS_LOST
      else -> null
    }
}

class CallWatch(mode: Int) {
  private var inCall = isCall(mode)

  fun began(mode: Int): Boolean {
    val wasInCall = inCall
    inCall = isCall(mode)
    return inCall && !wasInCall
  }

  private companion object {
    val CALL_MODES = setOf(
      AudioManager.MODE_RINGTONE,
      AudioManager.MODE_IN_CALL,
      AudioManager.MODE_IN_COMMUNICATION,
      AudioManager.MODE_CALL_SCREENING,
      AudioManager.MODE_CALL_REDIRECT,
      AudioManager.MODE_COMMUNICATION_REDIRECT,
    )

    fun isCall(mode: Int) = mode in CALL_MODES
  }
}
