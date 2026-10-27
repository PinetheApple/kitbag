package com.kitbag.corenative.transport

data class PracticeClock(val playedMillis: Long, val stretchStartedAt: Long?) {

  fun afterPlaying(playing: Boolean, now: Long): PracticeClock =
    when {
      playing == (stretchStartedAt != null) -> this
      playing -> copy(stretchStartedAt = now)
      else -> PracticeClock(elapsedMillis(now), null)
    }

  fun elapsedMillis(now: Long): Long =
    playedMillis + (stretchStartedAt?.let { (now - it).coerceAtLeast(0L) } ?: 0L)

  companion object {
    val IDLE = PracticeClock(0L, null)
  }
}
