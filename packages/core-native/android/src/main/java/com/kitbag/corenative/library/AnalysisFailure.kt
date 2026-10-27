package com.kitbag.corenative.library

import androidx.annotation.Keep
import java.io.IOException

object AnalysisFailure {
  const val MISSING_FILE = "missing-file"
  const val UNSUPPORTED = "unsupported"
  const val INTERRUPTED = "interrupted"
  const val INTERNAL = "internal"

  fun of(error: Throwable): String =
    when (error) {
      is MissingSongException, is UnsafeLibraryPathException -> MISSING_FILE
      is UnsupportedAudioException -> UNSUPPORTED
      else -> INTERNAL
    }
}

class MissingSongException : IOException("The song file is missing")

@Keep
class UnsupportedAudioException : IOException("The core could not decode the song")

@Keep
class AnalysisCoreException(val kbResult: Int) : IOException("kb_analyze_song failed with kb_result $kbResult")
