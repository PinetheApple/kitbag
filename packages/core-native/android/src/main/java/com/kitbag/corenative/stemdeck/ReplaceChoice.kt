package com.kitbag.corenative.stemdeck

enum class ReplaceMode(val code: String) {
  ADD("add"),
  REPLACE_JOB("replaceJob"),
  REPLACE_SET("replaceSet"),
  ;

  companion object {
    fun of(code: String): ReplaceMode =
      entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Not a replace mode")

    val CONSTANTS: Map<String, Any> = mapOf(
      "replaceAdd" to ADD.code,
      "replaceJob" to REPLACE_JOB.code,
      "replaceSet" to REPLACE_SET.code,
    )
  }
}

data class ReplaceChoice(val mode: ReplaceMode, val targetId: Long? = null) {
  init {
    require((mode == ReplaceMode.REPLACE_SET) == (targetId != null)) { "A replace target goes with replaceSet only" }
  }

  val code: String get() = mode.code

  val bridgeTarget: Double? get() = targetId?.toDouble()

  companion object {
    val ADD = ReplaceChoice(ReplaceMode.ADD)

    fun fromBridge(code: String, target: Double?): ReplaceChoice {
      val id = target?.toLong()
      require(id?.toDouble() == target) { "Not a stem set id" }
      return ReplaceChoice(ReplaceMode.of(code), id)
    }
  }
}
