package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.LibraryErrors
import com.kitbag.corenative.library.UnreadableStateException

data class FinishedReport(val outcome: String, val error: String?, val path: String?)

object MoveReport {
  const val DONE = "done"
  const val CANCELLED = "cancelled"
  const val AWAITING_RELEASE = "awaitingRelease"
  const val CLEANUP_DEFERRED = "cleanupDeferred"
  const val NO_MOVE = "noMove"
  const val FAILED = "failed"
  const val REFUSED = "refused"

  val CONSTANTS: Map<String, Any> = mapOf(
    "moveOutcomes" to listOf(DONE, CANCELLED, AWAITING_RELEASE, CLEANUP_DEFERRED, NO_MOVE, FAILED, REFUSED)
      .associateBy { it },
    "movePhases" to MovePhase.values().associate { LibraryErrors.camelCase(it.name) to it.name },
  ) + LibraryErrors.MOVE_CONSTANTS

  fun finished(outcome: MoveOutcome): FinishedReport =
    when (outcome) {
      MoveOutcome.Done -> FinishedReport(DONE, null, null)
      MoveOutcome.Cancelled -> FinishedReport(CANCELLED, null, null)
      MoveOutcome.AwaitingRelease -> FinishedReport(AWAITING_RELEASE, null, null)
      MoveOutcome.CleanupDeferred -> FinishedReport(CLEANUP_DEFERRED, null, null)
      MoveOutcome.NoMove -> FinishedReport(NO_MOVE, null, null)
      is MoveOutcome.Failed -> FinishedReport(FAILED, LibraryErrors.moveCode(outcome.failure), outcome.path)
      is MoveOutcome.Refused -> FinishedReport(REFUSED, LibraryErrors.moveCode(outcome.refusal), null)
    }

  fun codeFor(error: Throwable): String = LibraryErrors.codeFor(error, LibraryErrors.moveCode(failureOf(error)))

  fun failureOf(error: Throwable): MoveFailure =
    if (generateSequence(error) { it.cause }.any { it is UnreadableStateException }) {
      MoveFailure.STATE_UNREADABLE
    } else {
      MoveFailure.IO
    }

  fun errorOf(status: MoveStatus): String? = status.failure?.let(LibraryErrors::moveCode)

  fun volumeUuid(location: DataFolderLocation): String? = (location as? DataFolderLocation.Card)?.volumeUuid

  fun locationOf(volumeUuid: String?): DataFolderLocation =
    volumeUuid?.let(DataFolderLocation::Card) ?: DataFolderLocation.Internal
}
