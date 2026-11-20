package com.kitbag.corenative.transport

internal class SongEndWatch(private val endCount: () -> Long) {
  private var seen = endCount()

  fun ended(): Boolean {
    val now = endCount()
    if (now == seen) return false
    seen = now
    return true
  }
}
