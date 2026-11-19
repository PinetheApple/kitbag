package com.kitbag.corenative.library.move

import java.io.File

class OldRootRelease(private val mixdownRunning: () -> Boolean) : ReleaseGate {
  // Starts released: a new process holds no track loaded before a switch it did not make.
  @Volatile private var players = true

  fun holdPlayers() {
    players = false
  }

  fun releasePlayers() {
    players = true
  }

  fun playersReleased(): Boolean = players

  fun waitingForMixdown(): Boolean = players && mixdownRunning()

  override fun released(oldRoot: File): Boolean = players && !mixdownRunning()
}
