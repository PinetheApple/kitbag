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
    val live = fence.run(cardNumber) { true } == true
    when {
      !live -> if (!promoted && promote(notification, playing)) surface.remove()
      playing -> if (!promote(notification, playing)) surface.notify(notification)
      else -> postDetached(notification)
    }
    if (live) posted[fence] = cardNumber
  }

  // Withdrawing first means a post racing the cancel fails its fence instead of reviving the card.
  fun finish(ended: CardFence) {
    posted[ended]?.let { cardNumber -> ended.run(cardNumber) { ended.withdraw() } }
    posted.clear()
    surface.remove()
  }

  private fun postDetached(notification: N) {
    if (!promoted) promote(notification, playing = false)
    surface.detach()
    surface.notify(notification)
  }

  private fun promote(notification: N, playing: Boolean): Boolean {
    val refusal = surface.promote(notification)
    if (refusal == null) promoted = true else if (playing) warn(refusal)
    return refusal == null
  }
}
