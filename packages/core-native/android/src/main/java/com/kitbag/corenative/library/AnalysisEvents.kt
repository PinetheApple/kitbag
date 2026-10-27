package com.kitbag.corenative.library

import java.util.concurrent.atomic.AtomicReference

object AnalysisEvents {
  val listener = AtomicReference<((AnalysisResult) -> Unit)?>(null)
}
