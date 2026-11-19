package com.kitbag.corenative.stemdeck

sealed class ImportNotice {
  object None : ImportNotice()

  data class Running(val position: Int, val total: Int, val title: String, val phase: String, val percent: Int?) :
    ImportNotice()

  data class Finished(val added: Int, val left: Left?) : ImportNotice()

  data class Stopped(val reason: String, val added: Int, val total: Int, val left: Left, val canRetry: Boolean) :
    ImportNotice()

  data class Left(val firstTitle: String, val others: Int) {
    val count: Int get() = others + 1
  }
}

object ImportNotificationModel {
  const val PERCENT = 100

  fun of(snapshot: ImportSnapshot): ImportNotice {
    val items = snapshot.items
    val inHand = snapshot.current ?: items.firstOrNull { it.state == ItemState.WAITING }?.takeIf { snapshot.running }
    if (inHand != null) return running(items, inHand)
    if (items.isEmpty() || snapshot.stopReason == StemDeckFailure.CANCELLED) return ImportNotice.None
    val added = items.count { it.state == ItemState.ADDED }
    val left = left(items)
    val reason = snapshot.stopReason ?: return ImportNotice.Finished(added, left)
    if (left == null) return ImportNotice.Finished(added, null)
    return ImportNotice.Stopped(reason, added, items.size, left, canRetry = reason != StemDeckFailure.TIME_LIMIT)
  }

  private fun running(items: List<ItemState>, inHand: ItemState): ImportNotice.Running {
    val phase = if (inHand.state == ItemState.WAITING) ItemState.PREPARING else inHand.state
    val percent = if (phase == ItemState.DOWNLOADING && inHand.bytesTotal > 0) {
      (inHand.bytesDone * PERCENT / inHand.bytesTotal).toInt().coerceIn(0, PERCENT)
    } else {
      null
    }
    return ImportNotice.Running(items.indexOf(inHand) + 1, items.size, inHand.item.title, phase, percent)
  }

  private fun left(items: List<ItemState>): ImportNotice.Left? {
    val left = items.filter { it.retryable }
    val first = left.firstOrNull() ?: return null
    return ImportNotice.Left(first.item.title, left.size - 1)
  }
}

class NoticeThrottle(private val intervalMillis: Long = MIN_INTERVAL_MILLIS) {
  private var last: ImportNotice? = null
  private var postedAt = 0L

  // Only a percentage moving within one phase waits; every other change posts at once.
  @Synchronized
  fun admit(notice: ImportNotice, now: Long): Boolean {
    val previous = last
    if (notice == previous) return false
    val onlyProgress = previous is ImportNotice.Running && notice is ImportNotice.Running &&
      previous.copy(percent = notice.percent) == notice
    if (onlyProgress && now - postedAt < intervalMillis) return false
    last = notice
    postedAt = now
    return true
  }

  @Synchronized
  fun reset() {
    last = null
  }

  companion object {
    const val MIN_INTERVAL_MILLIS = 1000L
  }
}
