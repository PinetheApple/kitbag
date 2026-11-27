package com.kitbag.corenative.transport

import android.media.AudioManager

enum class Interruption {
  OUTPUT_LOST,
  CALL,
  FOCUS_LOST,
}

data class NowPlaying(val song: Boolean, val metronome: Boolean, val playAlongFollowing: Boolean) {
  val interruptible: Boolean
    get() = song || (metronome && !playAlongFollowing)

  companion object {
    fun of(
      metronomeShowing: Boolean,
      metronome: Playback?,
      songShownPlaying: Boolean,
      playAlongFollowing: Boolean,
    ) = NowPlaying(
      song = songShownPlaying,
      metronome = metronomeShowing && metronome == Playback.PLAYING,
      playAlongFollowing = playAlongFollowing,
    )
  }
}

data class Pauses(val song: Boolean, val metronome: Boolean)

object InterruptionRouting {
  private val METRONOME_PAUSES = setOf(Interruption.OUTPUT_LOST, Interruption.CALL)

  fun pauses(interruption: Interruption, playing: NowPlaying): Pauses =
    Pauses(
      song = playing.song,
      metronome = playing.metronome && !playing.playAlongFollowing && interruption in METRONOME_PAUSES,
    )

  // A regained focus never resumes a pause.
  fun ofFocusChange(change: Int): Interruption? =
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> Interruption.FOCUS_LOST
      else -> null
    }
}

enum class FocusCall {
  REQUEST,
  ABANDON,
  NONE,
}

class FocusHold {
  var held = false
    private set

  fun follow(playing: Boolean): FocusCall =
    when {
      playing && !held -> FocusCall.REQUEST
      !playing && held -> {
        held = false
        FocusCall.ABANDON
      }
      else -> FocusCall.NONE
    }

  fun requested(result: Int): Interruption? {
    held = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    return if (held) null else Interruption.FOCUS_LOST
  }

  fun changed(change: Int): Interruption? {
    if (change == AudioManager.AUDIOFOCUS_LOSS) held = false
    return InterruptionRouting.ofFocusChange(change)
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
    // The mode, unlike telephony call state, also shows voice-chat calls.
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
