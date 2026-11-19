package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation

data class MoveStatus(
  val source: DataFolderLocation,
  val target: DataFolderLocation,
  val progress: MoveProgress,
  val running: Boolean,
  val failure: MoveFailure?,
) {
  val phase: MovePhase get() = progress.phase

  val switched: Boolean get() = phase >= MovePhase.SWITCHED

  val paused: Boolean get() = !running && !switched

  val awaitingRelease: Boolean get() = !running && switched && failure == null

  companion object {
    fun of(state: MoveState?, running: Boolean, live: MoveProgress?): MoveStatus? {
      state ?: return null
      val progress = live?.takeIf { running && it.phase == state.phase } ?: state.progress(null)
      return MoveStatus(state.source, state.target, progress, running, state.failure)
    }
  }
}

sealed interface MoveEvent {
  data class Progress(val status: MoveStatus) : MoveEvent

  data class Finished(val outcome: MoveOutcome) : MoveEvent

  object Switched : MoveEvent
}
