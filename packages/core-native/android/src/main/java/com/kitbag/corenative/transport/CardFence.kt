package com.kitbag.corenative.transport

// Withdraw runs on the native-modules thread ahead of the app's next engine commands, so a body
// that passed the check has queued its own first; no body may wait on that thread or JS.
class CardFence {
  private var issued = NONE
  private var live = NONE

  @Synchronized
  fun issue(): Int {
    issued += 1
    live = issued
    return issued
  }

  @Synchronized
  fun keep(): Int = if (live == NONE) issue() else live

  @Synchronized
  fun withdraw() {
    live = NONE
  }

  @Synchronized
  fun holds(cardNumber: Int): Boolean = cardNumber != NONE && cardNumber == live

  @Synchronized
  fun <T> run(cardNumber: Int, body: () -> T): T? = if (holds(cardNumber)) body() else null

  companion object {
    const val NONE = 0
  }
}

class CardFences {
  val song = CardFence()
  val metronome = CardFence()
  private var metronomeShown = CardFence.NONE

  @Synchronized
  fun showMetronome(): Int = metronome.keep().also { metronomeShown = it }

  // Withdraws only the card this hide was sent for, never a card shown after it.
  fun hideMetronome(hide: () -> Unit) {
    val shown = synchronized(this) { metronomeShown }
    metronome.run(shown) { metronome.withdraw() }
    hide()
  }
}
