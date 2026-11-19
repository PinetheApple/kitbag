package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.DurableFiles
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.RootState
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.atomic.AtomicBoolean

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
  IO,
}

sealed interface MoveOutcome {
  object Done : MoveOutcome

  object Cancelled : MoveOutcome

  object AwaitingRelease : MoveOutcome

  object NoMove : MoveOutcome

  data class Failed(val failure: MoveFailure, val path: String? = null) : MoveOutcome
}

data class MoveProgress(val phase: MovePhase, val doneBytes: Long, val totalBytes: Long, val path: String?)

class MoveRunner(
  private val folder: DataFolder,
  private val journal: MoveJournal,
  private val availableBytes: (File) -> Long,
  private val gate: ReleaseGate,
  private val listener: (MoveProgress) -> Unit = {},
) {
  private class Stop(val outcome: MoveOutcome) : Exception()

  private val running = AtomicBoolean(false)
  private val cancelRequested = AtomicBoolean(false)
  private val switchLock = Any()

  @Volatile private var current: MoveState? = null

  fun pending(): MoveState? = journal.load()

  fun start(target: DataFolderLocation): MoveOutcome {
    check(journal.load() == null) { "A move is already in progress" }
    val source = folder.location()
    require(source != target) { "The data folder is already there" }
    val sourceState = folder.rootState()
    if (sourceState !is RootState.Mounted || !sourceState.known) {
      return MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE)
    }
    val files = MovePlan.scan(sourceState.root).map { MoveEntry(it.path, it.size, it.modified) }
    return drive(save(MoveState(source, target, MovePhase.PREFLIGHT, files)))
  }

  fun resume(): MoveOutcome = journal.load()?.let { drive(it.copy(failure = null)) } ?: MoveOutcome.NoMove

  fun cancel(): Boolean =
    synchronized(switchLock) {
      val state = current ?: journal.load() ?: return false
      if (state.phase >= MovePhase.SWITCHED) return false
      if (running.get()) {
        cancelRequested.set(true)
        return true
      }
      discard(state)
    }

  fun useInternalStorage(awayPaths: Collection<String>): Boolean {
    if (journal.load() != null) return false
    val card = folder.location() as? DataFolderLocation.Card ?: return false
    if (folder.rootState(card) !is RootState.Unmounted) return false
    folder.switching {
      folder.leaveAway(card.volumeUuid, awayPaths)
      folder.select(DataFolderLocation.Internal)
    }
    return true
  }

  private fun drive(initial: MoveState): MoveOutcome {
    check(running.compareAndSet(false, true)) { "A move is already running" }
    cancelRequested.set(false)
    var state = initial
    current = state
    try {
      while (true) {
        emit(state, null)
        state = when (state.phase) {
          MovePhase.PREFLIGHT -> preflight(state)
          MovePhase.COPYING -> copying(state)
          MovePhase.VERIFYING -> verifying(state)
          MovePhase.CATCH_UP -> catchUp(state)
          MovePhase.SWITCHED -> save(state.copy(phase = MovePhase.CLEANING))
          MovePhase.CLEANING -> cleaning(state)
          MovePhase.DONE -> {
            journal.clear()
            return MoveOutcome.Done
          }
        }
      }
    } catch (e: Stop) {
      return e.outcome
    } catch (e: InterruptedIOException) {
      val discarded = discard(current ?: state)
      return if (discarded) MoveOutcome.Cancelled else MoveOutcome.Failed(MoveFailure.TARGET_UNAVAILABLE)
    } catch (e: IOException) {
      current?.let { save(it.copy(failure = MoveFailure.IO.name)) }
      return MoveOutcome.Failed(MoveFailure.IO)
    } finally {
      current = null
      running.set(false)
    }
  }

  private fun preflight(state: MoveState): MoveState {
    val targetRoot = mountedRoot(state.target) ?: refuse(MoveFailure.TARGET_UNAVAILABLE)
    if (state.files.any { File(targetRoot, it.path).exists() }) refuse(MoveFailure.TARGET_OCCUPIED)
    if (!canWrite(targetRoot)) refuse(MoveFailure.TARGET_NOT_WRITABLE)
    if (availableBytes(targetRoot) < state.totalBytes + FREE_SPACE_MARGIN_BYTES) refuse(MoveFailure.NO_SPACE)
    return save(state.copy(phase = MovePhase.COPYING))
  }

  private fun refuse(failure: MoveFailure): Nothing {
    journal.clear()
    throw Stop(MoveOutcome.Failed(failure))
  }

  private fun canWrite(targetRoot: File): Boolean {
    val probe = File(targetRoot, PROBE_FILE_NAME)
    return try {
      if (!targetRoot.isDirectory && !targetRoot.mkdirs()) return false
      FileOutputStream(probe).use { output ->
        output.write(PROBE_BYTES)
        output.fd.sync()
      }
      probe.readBytes().contentEquals(PROBE_BYTES)
    } catch (e: IOException) {
      false
    } finally {
      probe.delete()
    }
  }

  private fun copying(state: MoveState): MoveState {
    val (sourceRoot, targetRoot) = roots(state)
    var next = state
    for (entry in state.files.filterNot { it.copied }) {
      val source = File(sourceRoot, entry.path)
      next = if (source.isFile) {
        val sha256 = DurableFiles.copy(source, File(targetRoot, entry.path), ::cancelling)
        save(next.withEntry(entry.copy(sha256 = sha256)))
      } else {
        save(next.copy(files = next.files - entry))
      }
      emit(next, entry.path)
    }
    return save(next.copy(phase = MovePhase.VERIFYING))
  }

  private fun verifying(state: MoveState): MoveState {
    val targetRoot = roots(state).second
    var next = state
    for (entry in state.files.filterNot { it.verified }) {
      if (!copyMatches(targetRoot, entry)) {
        val recopy = next.withEntry(entry.copy(sha256 = null))
        save(recopy.copy(phase = MovePhase.COPYING, failure = MoveFailure.HASH_MISMATCH.name))
        throw Stop(MoveOutcome.Failed(MoveFailure.HASH_MISMATCH, entry.path))
      }
      next = save(next.withEntry(entry.copy(verified = true)))
      emit(next, entry.path)
    }
    return save(next.copy(phase = MovePhase.CATCH_UP))
  }

  private fun copyMatches(targetRoot: File, entry: MoveEntry): Boolean {
    val copy = File(targetRoot, entry.path)
    return copy.isFile && DurableFiles.sha256(copy, ::cancelling) == entry.sha256
  }

  private fun catchUp(state: MoveState): MoveState {
    if (folder.location() == state.target) return save(state.copy(phase = MovePhase.SWITCHED))
    val (sourceRoot, targetRoot) = roots(state)
    return folder.switching {
      val scanned = MovePlan.scan(sourceRoot)
      val scannedPaths = scanned.mapTo(HashSet()) { it.path }
      val known = state.files.associateBy { it.path }
      state.files.filter { it.path !in scannedPaths }.forEach { deleteCopy(targetRoot, it.path) }
      var next = save(state.copy(files = state.files.filter { it.path in scannedPaths }))
      for (file in scanned.filter { known[it.path]?.matches(it) != true }) {
        val copied = catchUpCopy(sourceRoot, targetRoot, file)
        if (!copied.verified) {
          save(next.copy(failure = MoveFailure.HASH_MISMATCH.name))
          throw Stop(MoveOutcome.Failed(MoveFailure.HASH_MISMATCH, file.path))
        }
        next = save(next.withEntry(copied))
        emit(next, file.path)
      }
      switchTo(next)
    }
  }

  private fun catchUpCopy(sourceRoot: File, targetRoot: File, file: MoveSourceFile): MoveEntry {
    val target = File(targetRoot, file.path)
    val sha256 = DurableFiles.copy(File(sourceRoot, file.path), target, ::cancelling)
    val copied = MoveEntry(file.path, file.size, file.modified, sha256)
    if (copyMatches(targetRoot, copied)) return copied.copy(verified = true)
    deleteCopy(targetRoot, file.path)
    return copied
  }

  private fun switchTo(state: MoveState): MoveState =
    synchronized(switchLock) {
      if (cancelRequested.get()) throw InterruptedIOException()
      folder.select(state.target)
      save(state.copy(phase = MovePhase.SWITCHED))
    }

  private fun cleaning(state: MoveState): MoveState {
    val sourceRoot = mountedRoot(state.source) ?: throw Stop(MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE))
    if (!gate.released(sourceRoot)) throw Stop(MoveOutcome.AwaitingRelease)
    state.files.forEach { deleteCopy(sourceRoot, it.path) }
    return save(state.copy(phase = MovePhase.DONE))
  }

  private fun discard(state: MoveState): Boolean {
    val targetRoot = mountedRoot(state.target) ?: return false
    state.files.forEach { deleteCopy(targetRoot, it.path) }
    journal.clear()
    return true
  }

  private fun deleteCopy(root: File, relativePath: String) {
    val file = LibraryPaths.resolve(root, relativePath)
    DurableFiles.partOf(file).delete()
    if (file.exists() && !file.delete()) throw IOException("Could not delete $relativePath")
    pruneEmptyParents(root.canonicalFile, file.parentFile)
  }

  private fun pruneEmptyParents(root: File, from: File?) {
    var dir = from
    while (dir != null && dir != root && dir.parentFile != root && dir.list()?.isEmpty() == true) {
      dir.delete()
      dir = dir.parentFile
    }
  }

  private fun roots(state: MoveState): Pair<File, File> {
    val sourceRoot = mountedRoot(state.source) ?: throw Stop(MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE))
    val targetRoot = mountedRoot(state.target) ?: throw Stop(MoveOutcome.Failed(MoveFailure.TARGET_UNAVAILABLE))
    return sourceRoot to targetRoot
  }

  private fun mountedRoot(location: DataFolderLocation): File? =
    (folder.rootState(location) as? RootState.Mounted)?.root

  private fun cancelling(): Boolean = cancelRequested.get()

  private fun save(state: MoveState): MoveState {
    journal.save(state)
    current = state
    return state
  }

  private fun emit(state: MoveState, path: String?) {
    val verifying = state.phase == MovePhase.VERIFYING
    val done = state.files.filter { if (verifying) it.verified else it.copied }.sumOf { it.size }
    listener(MoveProgress(state.phase, done, state.totalBytes, path))
  }

  private fun MoveState.withEntry(entry: MoveEntry): MoveState {
    val others = files.filter { it.path != entry.path }
    return copy(files = (others + entry).sortedBy { it.path })
  }

  companion object {
    const val FREE_SPACE_MARGIN_BYTES = 128L * 1024 * 1024
    private const val PROBE_FILE_NAME = ".move-probe"
    private val PROBE_BYTES = "kitbag".toByteArray()
  }
}
