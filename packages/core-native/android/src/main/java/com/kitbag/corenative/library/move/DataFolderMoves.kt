package com.kitbag.corenative.library.move

import android.content.Context
import android.util.Log
import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.MixdownExport
import com.kitbag.corenative.library.RootState
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList

class DataFolderMoves(
  val folder: DataFolder,
  journal: MoveJournal,
  leftovers: AwayManifest,
  availableBytes: (File) -> Long,
  mixdownRunning: () -> Boolean,
  private val now: () -> Long = System::currentTimeMillis,
  private val pause: (Long) -> Unit = Thread::sleep,
) {
  val gate = OldRootRelease(mixdownRunning)
  private val runner = MoveRunner(folder, journal, leftovers, availableBytes, gate, ::progressed)
  private val watchers = CopyOnWriteArrayList<(MoveEvent) -> Unit>()

  @Volatile private var live: MoveProgress? = null
  private var publishedAt = 0L

  fun watch(watcher: (MoveEvent) -> Unit): () -> Unit {
    watchers.add(watcher)
    return { watchers.remove(watcher) }
  }

  fun running(): Boolean = runner.running()

  fun reportRefused(refusal: MoveRefusal) = publish(MoveEvent.Finished(MoveOutcome.Refused(refusal)))

  fun status(): MoveStatus? = MoveStatus.of(runner.pending(), runner.running(), live)

  fun refusalToStart(target: DataFolderLocation): MoveRefusal? {
    if (folder.location() == target) return MoveRefusal.SAME_LOCATION
    if (runner.running()) return MoveRefusal.IN_PROGRESS
    val pending = runner.pending() ?: return null
    val parkable = pending.phase >= MovePhase.SWITCHED && folder.rootStateAt(pending.source) is RootState.Unmounted
    return if (parkable) null else MoveRefusal.IN_PROGRESS
  }

  fun refusalToResume(): MoveRefusal? =
    when {
      runner.running() -> MoveRefusal.RUNNING
      runner.pending() == null -> MoveRefusal.NO_MOVE
      else -> null
    }

  fun start(target: DataFolderLocation): MoveOutcome =
    settle {
      refusalToStart(target)?.let { return@settle MoveOutcome.Refused(it) }
      runner.start(target)
    }

  fun resume(): MoveOutcome =
    settle {
      refusalToResume()?.let { return@settle MoveOutcome.Refused(it) }
      runner.resume()
    }

  fun cancel(): MoveRefusal? {
    if (runner.pending() == null && !runner.running()) return MoveRefusal.NO_MOVE
    return if (runner.cancel()) null else MoveRefusal.SWITCHED
  }

  fun undo(): MoveRefusal? = if (runner.running()) MoveRefusal.RUNNING else cancel()

  fun useInternalStorage(awayPaths: Collection<String>): MoveRefusal? {
    // A read-to-write upgrade on the import lock deadlocks rather than failing.
    check(folder.importLock.readHoldCount == 0) { "useInternalStorage called inside an import" }
    if (!runner.useInternalStorage(awayPaths)) return MoveRefusal.USE_INTERNAL_REFUSED
    publish(MoveEvent.Switched)
    return null
  }

  fun releaseOldCopies(): Boolean {
    gate.releasePlayers()
    return cleanupWaiting()
  }

  fun cleanupWaiting(): Boolean = status()?.awaitingRelease == true

  fun finishLeftovers(): Boolean = runner.finishLeftovers()

  private fun settle(run: () -> MoveOutcome): MoveOutcome {
    live = null
    var outcome = try {
      run()
    } catch (e: IllegalStateException) {
      MoveOutcome.Refused(MoveRefusal.IN_PROGRESS)
    }
    // Players released while the runner was saying no: retry; a mixdown is waited out, never cancelled.
    while (outcome == MoveOutcome.AwaitingRelease && gate.playersReleased()) {
      if (gate.waitingForMixdown()) pause(MIXDOWN_POLL_MILLIS)
      outcome = runner.resume()
    }
    publish(MoveEvent.Finished(outcome))
    return outcome
  }

  private fun progressed(progress: MoveProgress) {
    val previous = live
    live = progress
    val phaseChanged = previous?.phase != progress.phase
    if (phaseChanged && progress.phase == MovePhase.SWITCHED && previous?.phase == MovePhase.CATCH_UP) {
      gate.holdPlayers()
      publish(MoveEvent.Switched)
    }
    val at = now()
    if (!phaseChanged && at - publishedAt < PROGRESS_INTERVAL_MILLIS) return
    publishedAt = at
    status()?.let { publish(MoveEvent.Progress(it)) }
  }

  private fun publish(event: MoveEvent) = watchers.forEach { it(event) }

  companion object {
    const val LEFTOVERS_FILE_NAME = "data-folder-leftovers.json"
    const val MIXDOWN_POLL_MILLIS = 1000L
    const val PROGRESS_INTERVAL_MILLIS = 500L
    private const val TAG = "KitbagDataFolderMove"

    @Volatile private var instance: DataFolderMoves? = null

    fun get(context: Context): DataFolderMoves =
      instance ?: synchronized(this) {
        instance ?: create(context.applicationContext).also { instance = it }
      }

    private fun create(context: Context): DataFolderMoves {
      val warn: (String, Exception) -> Unit = { message, cause -> Log.w(TAG, message, cause) }
      val filesDir = context.filesDir
      return DataFolderMoves(
        DataFolder.get(context),
        MoveJournal(File(filesDir, MoveJournal.FILE_NAME), warn),
        AwayManifest(File(filesDir, LEFTOVERS_FILE_NAME), warn, "old copies on a removed card stay until it returns"),
        ::usableBytes,
        mixdownRunning(MixdownExport(context.cacheDir)),
      )
    }

    // The engine library loads with the commands module, which also starts every mixdown.
    private fun mixdownRunning(mixdown: MixdownExport): () -> Boolean = {
      try {
        mixdown.running()
      } catch (e: UnsatisfiedLinkError) {
        false
      }
    }

    fun usableBytes(target: File): Long =
      generateSequence(target.absoluteFile) { it.parentFile }.firstOrNull { it.exists() }?.usableSpace ?: 0L
  }
}
