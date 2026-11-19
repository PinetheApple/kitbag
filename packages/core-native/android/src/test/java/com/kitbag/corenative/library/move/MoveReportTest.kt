package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.LibraryErrors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MoveReportTest {
  private val codes = MoveFailure.values().map(LibraryErrors::moveCode) + MoveRefusal.values().map(LibraryErrors::moveCode)

  @Test
  fun `every failure and refusal has its own code`() {
    assertEquals(codes.size, codes.toSet().size)
    assertEquals(codes.size + 1, (codes + LibraryErrors.DATA_FOLDER_UNAVAILABLE).toSet().size)
  }

  @Test
  fun `the exported move errors carry every code under its own name`() {
    @Suppress("UNCHECKED_CAST")
    val exported = LibraryErrors.MOVE_CONSTANTS.getValue("moveErrors") as Map<String, String>
    assertEquals(codes.toSet(), exported.values.toSet())
    assertEquals("E_MOVE_TARGET_OCCUPIED", exported["targetOccupied"])
    assertEquals("E_MOVE_USE_INTERNAL_REFUSED", exported["useInternalRefused"])
  }

  @Test
  fun `a failed move reports its code and the file that failed`() {
    val report = MoveReport.finished(MoveOutcome.Failed(MoveFailure.TARGET_OCCUPIED, PATH))
    assertEquals(FinishedReport(MoveReport.FAILED, LibraryErrors.moveCode(MoveFailure.TARGET_OCCUPIED), PATH), report)
  }

  @Test
  fun `a refused move reports the refusal's code`() {
    val report = MoveReport.finished(MoveOutcome.Refused(MoveRefusal.FOREGROUND_REFUSED))
    assertEquals(MoveReport.REFUSED, report.outcome)
    assertEquals("E_MOVE_FOREGROUND_REFUSED", report.error)
  }

  @Test
  fun `outcomes without a failure carry no code`() {
    val quiet = listOf(
      MoveOutcome.Done,
      MoveOutcome.Cancelled,
      MoveOutcome.AwaitingRelease,
      MoveOutcome.CleanupDeferred,
      MoveOutcome.NoMove,
    )
    quiet.forEach { assertNull(it.toString(), MoveReport.finished(it).error) }
    assertEquals(quiet.size, quiet.map { MoveReport.finished(it).outcome }.toSet().size)
  }

  private companion object {
    const val PATH = "songs/b/b.mp3"
  }
}
