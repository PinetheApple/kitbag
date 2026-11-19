package com.kitbag.corenative.library.move

import java.io.File

fun interface ReleaseGate {
  fun released(oldRoot: File): Boolean
}

enum class MoveFailure {
  SOURCE_UNAVAILABLE,
  TARGET_UNAVAILABLE,
  TARGET_OCCUPIED,
  NO_SPACE,
  TARGET_NOT_WRITABLE,
  HASH_MISMATCH,
  TARGET_LEFTOVERS,
  STATE_UNREADABLE,
  IO,
}

sealed interface MoveOutcome {
  object Done : MoveOutcome

  object Cancelled : MoveOutcome

  object AwaitingRelease : MoveOutcome

  object NoMove : MoveOutcome

  object CleanupDeferred : MoveOutcome

  data class Failed(val failure: MoveFailure, val path: String? = null) : MoveOutcome

  data class Refused(val refusal: MoveRefusal) : MoveOutcome
}
