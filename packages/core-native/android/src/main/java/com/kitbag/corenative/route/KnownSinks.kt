package com.kitbag.corenative.route

class KnownSinks {
  private val handles = mutableSetOf<Int>()

  var lastAdded: Int? = null
    private set

  fun seed(sinks: List<SinkDevice>) {
    handles += sinks.map { it.handle }
  }

  fun added(sinks: List<SinkDevice>): Boolean {
    val fresh = sinks.filter { handles.add(it.handle) }
    if (fresh.isEmpty()) return false
    OutputRoutes.preferred(fresh)?.let { lastAdded = it.handle }
    return true
  }

  fun removed(sinks: List<SinkDevice>): Boolean {
    val gone = sinks.filter { handles.remove(it.handle) }.map { it.handle }
    if (gone.isEmpty()) return false
    if (lastAdded in gone) lastAdded = null
    return true
  }
}
