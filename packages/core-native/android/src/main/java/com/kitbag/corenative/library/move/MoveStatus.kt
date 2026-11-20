package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation

data class MoveStatus(
  val source: DataFolderLocation,
  val target: DataFolderLocation,
  val progress: MoveProgress,
  val running: Boolean,
  val failure: MoveFailure?,
  val switched: Boolean,
  val cardReturn: Boolean,
) {
  val phase: MovePhase get() = progress.phase

  val paused: Boolean get() = !running && !switched

  val awaitingRelease: Boolean get() = !running && switched && failure == null

  companion object {
    fun of(state: MoveState?, running: Boolean, live: MoveProgress?): MoveStatus? {
      state ?: return null
      val progress = live?.takeIf { running && it.phase == state.phase } ?: state.progress(null)
      val cardReturn = state.kind == MoveKind.CARD_RETURN
      return MoveStatus(state.source, state.target, progress, running, state.failure, state.switched, cardReturn)
    }
  }
}

sealed interface MoveEvent {
  data class Progress(val status: MoveStatus) : MoveEvent

  data class Finished(val outcome: MoveOutcome) : MoveEvent

  object Switched : MoveEvent
}
