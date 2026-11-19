package com.kitbag.corenative.transport

// Withdraw runs on the native-modules thread ahead of the teardown's stop, so a body that
// passed the check has queued its engine commands first; no body may wait on that thread or JS.
class SongCardFence {
  private var issued = NONE
  private var live = NONE

  @Synchronized
  fun issue(): Int {
    issued += 1
    live = issued
    return issued
  }

  @Synchronized
  fun withdraw() {
    live = NONE
  }

  @Synchronized
  fun <T> run(cardNumber: Int, body: () -> T): T? =
    if (cardNumber != NONE && cardNumber == live) body() else null

  companion object {
    const val NONE = 0
  }
}
