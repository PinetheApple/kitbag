package com.kitbag.corenative.stemdeck

class ImportItem(
  val jobId: String,
  val title: String,
  val stems: List<String>,
  val replace: ReplaceChoice = ReplaceChoice.ADD,
) {
  init {
    require(JOB_ID.matches(jobId)) { "Not a StemDeck job id" }
    require(stems.all(STEM_NAME::matches)) { "Not a StemDeck stem name" }
  }

  companion object {
    private val JOB_ID = Regex("^[a-f0-9]{12}$")
    private val STEM_NAME = Regex("^[a-z_]{1,32}$")
  }
}

data class ItemState(
  val item: ImportItem,
  val state: String,
  val failure: String? = null,
  val bytesDone: Long = 0,
  val bytesTotal: Long = UNKNOWN_BYTES,
  val bytesFree: Long = UNKNOWN_BYTES,
  val fileUri: String? = null,
) {
  val final: Boolean get() = state in FINAL_STATES

  val retryable: Boolean get() = state == FAILED || state == NOT_STARTED

  companion object {
    const val UNKNOWN_BYTES = -1L
    const val WAITING = "waiting"
    const val PREPARING = "preparing"
    const val DOWNLOADING = "downloading"
    const val ADDING = "adding"
    const val ADDED = "added"
    const val SKIPPED = "skipped"
    const val FAILED = "failed"
    const val NOT_STARTED = "notStarted"
    val IN_FLIGHT = setOf(PREPARING, DOWNLOADING, ADDING)
    private val FINAL_STATES = setOf(ADDED, SKIPPED, FAILED, NOT_STARTED)

    val CONSTANTS: Map<String, Any> = mapOf(
      "stateWaiting" to WAITING,
      "statePreparing" to PREPARING,
      "stateDownloading" to DOWNLOADING,
      "stateAdding" to ADDING,
      "stateAdded" to ADDED,
      "stateSkipped" to SKIPPED,
      "stateFailed" to FAILED,
      "stateNotStarted" to NOT_STARTED,
    )
  }
}

data class ImportSnapshot(
  val origin: String?,
  val running: Boolean,
  val stopReason: String?,
  val items: List<ItemState>,
) {
  val current: ItemState? get() = items.firstOrNull { it.state in ItemState.IN_FLIGHT }

  companion object {
    val EMPTY = ImportSnapshot(null, false, null, emptyList())
  }
}

object SettleOutcome {
  const val ADDED = "added"
  const val SKIPPED = "skipped"
  const val REFUSED = "refused"
  const val FAILED = "failed"

  val CONSTANTS: Map<String, Any> = mapOf(
    "settleAdded" to ADDED,
    "settleSkipped" to SKIPPED,
    "settleRefused" to REFUSED,
    "settleFailed" to FAILED,
  )
}

class ImportQueue {
  private var snapshot = ImportSnapshot.EMPTY

  @Synchronized fun snapshot(): ImportSnapshot = snapshot

  @Synchronized
  fun start(origin: String, items: List<ImportItem>): Boolean {
    if (snapshot.running || items.isEmpty()) return false
    val states = items.distinctBy { it.jobId }.map { ItemState(it, ItemState.WAITING) }
    snapshot = ImportSnapshot(origin, true, null, states)
    return true
  }

  @Synchronized
  fun retry(): Boolean {
    val again = snapshot.items.any { it.retryable }
    if (snapshot.running || snapshot.origin == null || !again) return false
    snapshot = snapshot.copy(
      running = true,
      stopReason = null,
      items = snapshot.items.map { if (it.retryable) ItemState(it.item, ItemState.WAITING) else it },
    )
    return true
  }

  // A song still being added after a stop settles later, so the queue keeps it until then.
  @Synchronized
  fun clear(): Boolean {
    if (snapshot.running || snapshot.items.any { it.state == ItemState.ADDING }) return false
    snapshot = ImportSnapshot.EMPTY
    return true
  }

  @Synchronized
  fun next(): ItemState? {
    if (!snapshot.running) return null
    val waiting = snapshot.items.firstOrNull { it.state == ItemState.WAITING }
    if (waiting == null) {
      snapshot = snapshot.copy(running = false)
      return null
    }
    return update(waiting.item.jobId) { it.copy(state = ItemState.PREPARING) }
  }

  @Synchronized
  fun downloading(jobId: String, total: Long) =
    update(jobId) { it.copy(state = ItemState.DOWNLOADING, bytesTotal = total, bytesDone = 0) }

  @Synchronized fun progress(jobId: String, done: Long) = update(jobId) { it.copy(bytesDone = done) }

  @Synchronized
  fun adding(jobId: String, fileUri: String) =
    update(jobId) { it.copy(state = ItemState.ADDING, fileUri = fileUri) }

  @Synchronized
  fun settle(jobId: String, outcome: String): Boolean {
    if (!isAdding(jobId)) return false
    update(jobId) {
      when (outcome) {
        SettleOutcome.ADDED -> it.copy(state = ItemState.ADDED, fileUri = null)
        SettleOutcome.SKIPPED -> it.copy(state = ItemState.SKIPPED, fileUri = null)
        else -> it.copy(state = ItemState.FAILED, failure = settleFailure(outcome), fileUri = null)
      }
    }
    return true
  }

  @Synchronized
  fun fail(
    jobId: String,
    code: String,
    bytesNeeded: Long = ItemState.UNKNOWN_BYTES,
    bytesFree: Long = ItemState.UNKNOWN_BYTES,
  ) {
    update(jobId) {
      val total = if (bytesNeeded == ItemState.UNKNOWN_BYTES) it.bytesTotal else bytesNeeded
      it.copy(state = ItemState.FAILED, failure = code, fileUri = null, bytesTotal = total, bytesFree = bytesFree)
    }
    if (StemDeckFailure.stopsQueue(code)) stop(code)
  }

  @Synchronized
  fun expire(jobId: String): Boolean {
    if (!isAdding(jobId)) return false
    fail(jobId, StemDeckFailure.NOT_ADDED)
    return true
  }

  // A song being added is left to finish: its bundle is complete and the import is already under way.
  // An earlier reason stands, so a kill after the time limit still reads as the time limit.
  @Synchronized
  fun stop(reason: String) {
    snapshot = snapshot.copy(
      running = false,
      stopReason = snapshot.stopReason ?: reason,
      items = snapshot.items.map {
        if (it.final || it.state == ItemState.ADDING) it else it.copy(state = ItemState.NOT_STARTED, fileUri = null)
      },
    )
  }

  @Synchronized
  fun restoreInterrupted(saved: ImportSnapshot) {
    snapshot = saved.copy(
      running = false,
      stopReason = saved.stopReason ?: StemDeckFailure.INTERRUPTED.takeIf { saved.items.any { !it.final } },
      items = saved.items.map { interrupted(it) },
    )
  }

  private fun interrupted(item: ItemState): ItemState =
    when {
      item.final -> item
      item.state in ItemState.IN_FLIGHT ->
        item.copy(state = ItemState.FAILED, failure = StemDeckFailure.INTERRUPTED, fileUri = null)
      else -> item.copy(state = ItemState.NOT_STARTED)
    }

  private fun settleFailure(outcome: String) =
    if (outcome == SettleOutcome.REFUSED) StemDeckFailure.REFUSED else StemDeckFailure.ADD_FAILED

  private fun isAdding(jobId: String) = snapshot.items.any { it.item.jobId == jobId && it.state == ItemState.ADDING }

  private fun update(jobId: String, change: (ItemState) -> ItemState): ItemState? {
    var changed: ItemState? = null
    snapshot = snapshot.copy(
      items = snapshot.items.map { if (it.item.jobId == jobId) change(it).also { next -> changed = next } else it },
    )
    return changed
  }
}
