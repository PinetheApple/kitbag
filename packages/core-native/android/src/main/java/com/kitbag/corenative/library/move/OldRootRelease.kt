package com.kitbag.corenative.library.move

import java.io.File

class OldRootRelease(private val mixdownRunning: () -> Boolean) : ReleaseGate {
  // Starts released: a new process holds no track loaded before a switch it did not make.
  @Volatile var playersReleased = true
    private set

  fun holdPlayers() {
    playersReleased = false
  }

  fun releasePlayers() {
    playersReleased = true
  }

  fun waitingForMixdown(): Boolean = playersReleased && mixdownRunning()

  override fun released(oldRoot: File): Boolean = playersReleased && !mixdownRunning()
}
