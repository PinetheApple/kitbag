package com.kitbag.corenative.library.move

data class MoveNotice(
  val stage: Stage,
  val doneBytes: Long,
  val totalBytes: Long,
  val percent: Int,
  val cancellable: Boolean,
) {
  enum class Stage { COPYING, CHECKING, CLEANING }

  companion object {
    const val PROGRESS_MAX = 100

    fun of(status: MoveStatus): MoveNotice {
      val progress = status.progress
      val stage = when {
        status.switched -> Stage.CLEANING
        progress.phase == MovePhase.VERIFYING || progress.phase == MovePhase.CATCH_UP -> Stage.CHECKING
        else -> Stage.COPYING
      }
      val percent = if (progress.totalBytes > 0) {
        (progress.doneBytes * PROGRESS_MAX / progress.totalBytes).toInt().coerceIn(0, PROGRESS_MAX)
      } else {
        0
      }
      return MoveNotice(stage, progress.doneBytes, progress.totalBytes, percent, cancellable = !status.switched)
    }
  }
}
