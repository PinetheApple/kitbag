package com.kitbag.corenative

import android.content.Context
import android.os.Process
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.kitbag.corenative.library.AnalysisEvents
import com.kitbag.corenative.library.AnalysisResult
import com.kitbag.corenative.library.AnalysisRun
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.LibraryStorage
import com.kitbag.corenative.library.MissingSongException
import com.kitbag.corenative.library.SongAnalyzer

class AnalysisWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    val relativePath = inputData.getString(KEY_RELATIVE_PATH) ?: return Result.failure()
    val waveformRelativeDir = inputData.getString(KEY_WAVEFORM_DIR).orEmpty()
    val previousPriority = Process.getThreadPriority(Process.myTid())
    Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
    try {
      val result = AnalysisRun.execute(
        LibraryStorage.analysisStore(applicationContext),
        relativePath,
        ::isStopped,
        { Log.w(TAG, "Analysis of $relativePath failed", it) },
      ) { analyze(relativePath, waveformRelativeDir) } ?: return Result.failure()
      emit(result)
      return if (result.ok) Result.success() else Result.failure()
    } finally {
      Process.setThreadPriority(previousPriority)
    }
  }

  private fun emit(result: AnalysisResult) {
    try {
      AnalysisEvents.listener.get()?.invoke(result)
    } catch (e: RuntimeException) {
      Log.w(TAG, "Could not emit the analysis result; it stays stored", e)
    }
  }

  private fun analyze(relativePath: String, waveformRelativeDir: String): AnalysisResult {
    val base = LibraryStorage.base(applicationContext)
    val song = LibraryPaths.resolve(base, relativePath)
    if (!song.isFile) throw MissingSongException()
    val waveformDir = LibraryPaths.resolve(base, waveformRelativeDir, allowBase = true)
    val output = SongAnalyzer.analyze(song, waveformDir, LibraryStorage.staging(applicationContext))
    return AnalysisResult(
      relativePath = relativePath,
      ok = true,
      error = "",
      bpm = output.result.bpm,
      beats = output.result.beats,
      downbeats = output.result.downbeats,
      waveformRelativePath = output.waveform?.let { LibraryPaths.relativize(base, it) }.orEmpty(),
    )
  }

  companion object {
    private const val TAG = "KitbagAnalysis"
    const val KEY_RELATIVE_PATH = "relativePath"
    const val KEY_WAVEFORM_DIR = "waveformRelativeDir"
  }
}
