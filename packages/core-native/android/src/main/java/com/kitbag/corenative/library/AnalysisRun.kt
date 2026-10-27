package com.kitbag.corenative.library

object AnalysisRun {
  // A process can die mid-analysis for reasons the song did not cause (low
  // memory kill, force stop, update), so only a repeat marks the song.
  const val MAX_INTERRUPTED_ATTEMPTS = 2

  // Runs share one .analysis-staging dir, wiped on entry, and one .running
  // marker per song; two concurrent runs would wipe each other's state.
  private val analysisLock = Any()

  fun execute(
    store: AnalysisStore,
    relativePath: String,
    isStopped: () -> Boolean,
    onError: (Throwable) -> Unit = {},
    analyze: () -> AnalysisResult,
  ): AnalysisResult? =
    synchronized(analysisLock) {
      if (isStopped()) return null
      val interrupted = store.interruptedAttempts(relativePath)
      if (interrupted >= MAX_INTERRUPTED_ATTEMPTS) {
        store.clearRunning(relativePath)
        return AnalysisResult.failed(relativePath, AnalysisFailure.INTERRUPTED).also(store::save)
      }
      store.markRunning(relativePath, interrupted + 1)
      val result = try {
        analyze()
      } catch (e: Throwable) {
        onError(e)
        AnalysisResult.failed(relativePath, AnalysisFailure.of(e))
      } finally {
        store.clearRunning(relativePath)
      }
      if (isStopped()) null else result.also(store::save)
    }
}
