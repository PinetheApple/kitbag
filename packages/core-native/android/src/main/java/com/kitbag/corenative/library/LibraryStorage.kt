package com.kitbag.corenative.library

import android.content.Context
import java.io.File

object LibraryStorage {
  private const val BASE_DIR_NAME = "library"
  private const val STAGING_DIR_NAME = ".analysis-staging"
  private const val RESULTS_DIR_NAME = ".analysis-results"

  fun base(context: Context) = File(context.filesDir, BASE_DIR_NAME)

  fun staging(context: Context) = File(base(context), STAGING_DIR_NAME)

  fun analysisStore(context: Context) = AnalysisStore(File(base(context), RESULTS_DIR_NAME))
}
