package com.kitbag.corenative.stemdeck

// The queue reads as running once it changes, so a refused service start must stop it again.
object ImportLaunch {
  fun launch(queue: ImportQueue, change: () -> Boolean, start: () -> Unit, publish: () -> Unit): Boolean {
    if (!change()) return false
    try {
      start()
    } catch (e: RuntimeException) {
      queue.stop(StemDeckFailure.INTERRUPTED)
      publish()
      throw StemDeckException(StemDeckFailure.INTERRUPTED, e)
    }
    return true
  }
}
