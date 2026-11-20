package com.kitbag.corenative.transport

interface CardSurface<N> {
  fun promote(notification: N): Throwable?

  fun detach()

  fun notify(notification: N)

  fun remove()
}

class CardPoster<N>(private val surface: CardSurface<N>, private val warn: (Throwable) -> Unit) {
  private var promoted = false
  private val posted = mutableMapOf<CardFence, Int>()

  // A service started for the foreground must promote even for a withdrawn card, or Android stops the app.
  fun post(notification: N, playing: Boolean, fence: CardFence, cardNumber: Int) {
    val live = fence.holds(cardNumber)
    when {
      !live -> satisfyForegroundStart(notification)
      playing -> postPlaying(notification)
      else -> postDetached(notification)
    }
    if (live) posted[fence] = cardNumber
  }

  // Withdrawing first means a post racing the cancel fails its fence instead of reviving the card.
  // Only the posted number is withdrawn, so a card the app has issued since keeps its fence.
  fun finish() {
    posted.forEach { (fence, cardNumber) -> fence.run(cardNumber) { fence.withdraw() } }
    posted.clear()
    promoted = false
    surface.remove()
  }

  private fun satisfyForegroundStart(notification: N) {
    if (!promoted && promote(notification) == null) surface.remove()
  }

  private fun postPlaying(notification: N) {
    val refusal = promote(notification) ?: return
    warn(refusal)
    surface.notify(notification)
  }

  private fun postDetached(notification: N) {
    if (!promoted) promote(notification)
    surface.notify(notification)
    surface.detach()
  }

  private fun promote(notification: N): Throwable? =
    surface.promote(notification).also { if (it == null) promoted = true }
}
