package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.AwayManifest
import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.DurableFiles
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.RootState
import com.kitbag.corenative.library.UnreadableStateException
import java.io.File
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.atomic.AtomicBoolean

data class MoveProgress(
  val phase: MovePhase,
  val doneBytes: Long,
  val totalBytes: Long,
  val doneFiles: Int,
  val totalFiles: Int,
  val path: String?,
)

fun MoveState.progress(path: String?): MoveProgress {
  val done = files.filter { if (phase == MovePhase.VERIFYING) it.verified else it.copied }
  return MoveProgress(phase, done.sumOf { it.size }, totalBytes, done.size, files.size, path)
}

class MoveRunner(
  private val folder: DataFolder,
  private val journal: MoveJournal,
  private val leftovers: AwayManifest,
  private val availableBytes: (File) -> Long,
  private val gate: ReleaseGate,
  private val listener: (MoveProgress) -> Unit = {},
) {
  private class Stop(val outcome: MoveOutcome) : Exception()

  private val running = AtomicBoolean(false)
  private val cancelRequested = AtomicBoolean(false)
  private val cancelOrSwitchLock = Any()

  @Volatile private var current: MoveState? = null

  fun pending(): MoveState? = journal.load()

  fun running(): Boolean = running.get()

  fun start(target: DataFolderLocation): MoveOutcome {
    val source = folder.location()
    require(source != target) { "The data folder is already there" }
    finishLeftovers()
    if (target is DataFolderLocation.Card && leftovers.load()?.containsKey(target.volumeUuid) != false) {
      return MoveOutcome.Failed(MoveFailure.TARGET_LEFTOVERS)
    }
    val sourceState = folder.rootState()
    if (sourceState !is RootState.Mounted || !sourceState.known) {
      return MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE)
    }
    val files = MovePlan.scan(sourceState.root).map { MoveEntry(it.path, it.size, it.modified) }
    return drive(beginNew(MoveState(source, target, MovePhase.PREFLIGHT, files)))
  }

  fun returnCard(card: DataFolderLocation.Card): MoveOutcome {
    val target = folder.location()
    require(card != target) { "The card is the data folder" }
    finishLeftovers()
    val cardRoot = mountedRoot(card) ?: return MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE)
    val away = folder.awayOn(card.volumeUuid) ?: throw UnreadableStateException(AwayManifest.FILE_NAME)
    if (away.isEmpty()) return MoveOutcome.NoMove
    val files = CardReturn.plan(cardRoot, away)
    return drive(beginNew(MoveState(card, target, MovePhase.PREFLIGHT, files, kind = MoveKind.CARD_RETURN)))
  }

  private fun beginNew(state: MoveState): MoveState =
    synchronized(cancelOrSwitchLock) {
      journal.load()?.takeIf { !running.get() && it.phase >= MovePhase.SWITCHED }?.let(::parkIfSourceGone)
      check(journal.load() == null) { "A move is already in progress" }
      begin(save(state))
    }

  fun resume(): MoveOutcome {
    val state = synchronized(cancelOrSwitchLock) { journal.load()?.copy(failure = null)?.let(::begin) }
    return state?.let(::drive) ?: MoveOutcome.NoMove
  }

  fun cancel(): Boolean =
    synchronized(cancelOrSwitchLock) {
      val state = current ?: journal.load() ?: return false
      if (state.phase >= MovePhase.SWITCHED || maybeSwitched(state)) return false
      if (running.get()) {
        cancelRequested.set(true)
        return true
      }
      discard(state)
    }

  fun useInternalStorage(awayPaths: Collection<String>): MoveRefusal? {
    if (journal.load() != null) return MoveRefusal.IN_PROGRESS
    val card = folder.location() as? DataFolderLocation.Card ?: return MoveRefusal.NOT_ON_CARD
    if (folder.rootStateAt(card) !is RootState.Unmounted) return MoveRefusal.CARD_MOUNTED
    folder.switching {
      val elsewhere = folder.awayElsewhere(card.volumeUuid) ?: throw UnreadableStateException(AwayManifest.FILE_NAME)
      val onCard = awayPaths.filter { it !in elsewhere && !LibraryPaths.resolve(folder.internalRoot, it).exists() }
      folder.leaveAway(card.volumeUuid, onCard)
      folder.select(DataFolderLocation.Internal)
    }
    return null
  }

  private fun begin(state: MoveState): MoveState {
    check(running.compareAndSet(false, true)) { "A move is already running" }
    cancelRequested.set(false)
    current = state
    return state
  }

  private fun drive(initial: MoveState): MoveOutcome {
    var state = initial
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
      current?.let(::recordIoFailure)
      return MoveOutcome.Failed(MoveFailure.IO)
    } finally {
      current = null
      running.set(false)
    }
  }

  private fun recordIoFailure(state: MoveState) {
    try {
      save(state.copy(failure = MoveFailure.IO))
    } catch (e: IOException) {
      // The journal keeps its last good state, which resume can still use.
    }
  }

  private fun preflight(state: MoveState): MoveState {
    val targetRoot = mountedRoot(state.target) ?: refuse(MoveFailure.TARGET_UNAVAILABLE)
    if (state.files.any { File(targetRoot, it.path).exists() }) refuse(MoveFailure.TARGET_OCCUPIED)
    if (state.kind == MoveKind.CARD_RETURN) CardReturn.stagingRoot(targetRoot).deleteRecursively()
    if (!MoveFiles.canWrite(targetRoot)) refuse(MoveFailure.TARGET_NOT_WRITABLE)
    if (availableBytes(targetRoot) < state.totalBytes + FREE_SPACE_MARGIN_BYTES) refuse(MoveFailure.NO_SPACE)
    return save(state.copy(phase = MovePhase.COPYING))
  }

  private fun refuse(failure: MoveFailure): Nothing {
    journal.clear()
    throw Stop(MoveOutcome.Failed(failure))
  }

  private fun copying(state: MoveState): MoveState {
    val (sourceRoot, targetRoot) = roots(state)
    val copyRoot = copyRoot(state, targetRoot)
    var next = state
    for (entry in state.files.filterNot { it.copied }) {
      val source = File(sourceRoot, entry.path)
      next = if (source.isFile) {
        val sha256 = DurableFiles.copyAndHash(source, File(copyRoot, entry.path), cancelRequested::get)
        save(next.withEntry(entry.copy(sha256 = sha256)))
      } else {
        if (mountedRoot(state.source) == null) throw Stop(MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE))
        save(next.copy(files = next.files - entry))
      }
      emit(next, entry.path)
    }
    return save(next.copy(phase = MovePhase.VERIFYING))
  }

  private fun verifying(state: MoveState): MoveState {
    val targetRoot = copyRoot(state, roots(state).second)
    var next = state
    for (entry in state.files.filterNot { it.verified }) {
      if (!copyMatches(targetRoot, entry)) {
        val recopy = next.withEntry(entry.copy(sha256 = null))
        save(recopy.copy(phase = MovePhase.COPYING, failure = MoveFailure.HASH_MISMATCH))
        throw Stop(MoveOutcome.Failed(MoveFailure.HASH_MISMATCH, entry.path))
      }
      next = save(next.withEntry(entry.copy(verified = true)))
      emit(next, entry.path)
    }
    return save(next.copy(phase = MovePhase.CATCH_UP))
  }

  private fun copyMatches(targetRoot: File, entry: MoveEntry): Boolean {
    val copy = File(targetRoot, entry.path)
    return copy.isFile && DurableFiles.sha256(copy, cancelRequested::get) == entry.sha256
  }

  private fun catchUp(state: MoveState): MoveState {
    if (state.kind == MoveKind.CARD_RETURN) return folder.switching { switchTo(state) }
    if (switched(state)) return save(state.copy(phase = MovePhase.SWITCHED))
    val (sourceRoot, targetRoot) = roots(state)
    return folder.switching {
      val scanned = MovePlan.scan(sourceRoot)
      val scannedPaths = scanned.mapTo(HashSet()) { it.path }
      val known = state.files.associateBy { it.path }
      state.files.filter { it.path !in scannedPaths }.forEach { MoveFiles.deleteCopy(targetRoot, it.path) }
      var next = save(state.copy(files = state.files.filter { it.path in scannedPaths }))
      for (file in scanned.filterNot { known[it.path]?.isCopyOf(it) == true }) {
        if (file.path !in known && File(targetRoot, file.path).exists()) {
          save(next.copy(failure = MoveFailure.TARGET_OCCUPIED))
          throw Stop(MoveOutcome.Failed(MoveFailure.TARGET_OCCUPIED, file.path))
        }
        next = save(next.withEntry(MoveEntry(file.path, file.size, file.modified)))
        val copied = catchUpCopy(sourceRoot, targetRoot, file)
        if (!copied.verified) {
          save(next.copy(failure = MoveFailure.HASH_MISMATCH))
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
    val sha256 = DurableFiles.copyAndHash(File(sourceRoot, file.path), target, cancelRequested::get)
    val copied = MoveEntry(file.path, file.size, file.modified, sha256)
    if (copyMatches(targetRoot, copied)) return copied.copy(verified = true)
    MoveFiles.deleteCopy(targetRoot, file.path)
    return copied
  }

  private fun switchTo(state: MoveState): MoveState =
    synchronized(cancelOrSwitchLock) {
      if (cancelRequested.get()) throw InterruptedIOException()
      if (state.kind == MoveKind.CARD_RETURN) {
        placeReturned(save(state.copy(placing = true)))
      } else {
        folder.select(state.target)
        listOf(state.source, state.target).filterIsInstance<DataFolderLocation.Card>()
          .forEach { folder.forgetAway(it.volumeUuid) }
      }
      save(state.copy(phase = MovePhase.SWITCHED))
    }

  private fun placeReturned(state: MoveState) {
    val card = state.source as DataFolderLocation.Card
    val targetRoot = mountedRoot(state.target) ?: throw Stop(MoveOutcome.Failed(MoveFailure.TARGET_UNAVAILABLE))
    val away = folder.awayOn(card.volumeUuid) ?: throw UnreadableStateException(AwayManifest.FILE_NAME)
    for (entry in state.files) {
      if (entry.path in away) CardReturn.place(targetRoot, entry.path) else CardReturn.discard(targetRoot, entry.path)
      emit(state, entry.path)
    }
    folder.forgetAway(card.volumeUuid, state.files.map { it.path })
  }

  private fun switched(state: MoveState) = folder.storedLocation() == state.target

  private fun maybeSwitched(state: MoveState): Boolean {
    if (state.kind == MoveKind.CARD_RETURN) return state.switched
    return folder.storedLocation().let { stored -> stored == null || stored == state.target }
  }

  private fun copyRoot(state: MoveState, targetRoot: File): File =
    if (state.kind == MoveKind.CARD_RETURN) CardReturn.stagingRoot(targetRoot) else targetRoot

  private fun copyPath(state: MoveState, path: String): String =
    if (state.kind == MoveKind.CARD_RETURN) CardReturn.stagedPath(path) else path

  // Parked before it leaves the away list, so the card copy is never in neither.
  @Synchronized
  fun supersede(relativePath: String) {
    for (volumeUuid in folder.awayHolders(relativePath)) {
      leftovers.record(volumeUuid, listOf(relativePath))
      folder.forgetAway(volumeUuid, listOf(relativePath))
    }
  }

  @Synchronized
  fun finishLeftovers(): Boolean {
    val parked = leftovers.load() ?: return false
    val live = setOfNotNull(folder.storedLocation(), journal.load()?.target)
    var finished = true
    for ((volumeUuid, paths) in parked) {
      val card = DataFolderLocation.Card(volumeUuid)
      val root = mountedRoot(card)?.takeIf { card !in live }
      if (root == null) {
        finished = false
        continue
      }
      val kept = paths.filterTo(HashSet()) { !deleted(root, it) }
      leftovers.replace(volumeUuid, kept)
      finished = finished && kept.isEmpty()
    }
    return finished
  }

  private fun deleted(root: File, relativePath: String): Boolean =
    try {
      MoveFiles.deleteCopy(root, relativePath)
      true
    } catch (e: IOException) {
      false
    }

  private fun parkCopies(card: DataFolderLocation.Card, paths: List<String>) {
    leftovers.record(card.volumeUuid, paths)
    journal.clear()
  }

  private fun parkIfSourceGone(state: MoveState): Boolean {
    val card = state.source as? DataFolderLocation.Card ?: return false
    if (mountedRoot(card) != null) return false
    parkCopies(card, state.files.map { it.path })
    return true
  }

  private fun cleaning(state: MoveState): MoveState {
    if (parkIfSourceGone(state)) throw Stop(MoveOutcome.CleanupDeferred)
    val sourceRoot = mountedRoot(state.source) ?: throw Stop(MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE))
    if (!gate.released(sourceRoot)) throw Stop(MoveOutcome.AwaitingRelease)
    state.files.forEach { MoveFiles.deleteCopy(sourceRoot, it.path) }
    return save(state.copy(phase = MovePhase.DONE))
  }

  // Preflight proved every planned path absent on the target, so past it each one present there is ours.
  private fun discard(state: MoveState): Boolean {
    if (maybeSwitched(state)) return false
    if (state.phase > MovePhase.PREFLIGHT) {
      val targetRoot = mountedRoot(state.target)
      val card = state.target as? DataFolderLocation.Card
      if (targetRoot == null && card != null) {
        parkCopies(card, state.files.map { copyPath(state, it.path) })
        return true
      }
      targetRoot ?: return false
      val copyRoot = copyRoot(state, targetRoot)
      state.files.forEach { MoveFiles.deleteCopy(copyRoot, it.path) }
    }
    journal.clear()
    return true
  }

  private fun roots(state: MoveState): Pair<File, File> {
    val sourceRoot = mountedRoot(state.source) ?: throw Stop(MoveOutcome.Failed(MoveFailure.SOURCE_UNAVAILABLE))
    val targetRoot = mountedRoot(state.target) ?: throw Stop(MoveOutcome.Failed(MoveFailure.TARGET_UNAVAILABLE))
    return sourceRoot to targetRoot
  }

  private fun mountedRoot(location: DataFolderLocation): File? =
    (folder.rootStateAt(location) as? RootState.Mounted)?.root

  private fun save(state: MoveState): MoveState {
    journal.save(state)
    current = state
    return state
  }

  private fun emit(state: MoveState, path: String?) = listener(state.progress(path))

  private fun MoveState.withEntry(entry: MoveEntry): MoveState {
    val others = files.filter { it.path != entry.path }
    return copy(files = (others + entry).sortedBy { it.path })
  }

  companion object {
    const val FREE_SPACE_MARGIN_BYTES = 128L * 1024 * 1024
  }
}
