package com.kitbag.corenative.library

import android.content.Context
import java.io.File

object LibraryStorage {
  private const val STAGING_DIR_NAME = ".analysis-staging"
  private const val RESULTS_DIR_NAME = ".analysis-results"

  fun staging(folder: DataFolder) = File(folder.internalRoot, STAGING_DIR_NAME)

  fun resultsDir(folder: DataFolder) = File(folder.internalRoot, RESULTS_DIR_NAME)

  fun staging(context: Context) = staging(DataFolder.get(context))

  fun analysisStore(context: Context) = AnalysisStore(resultsDir(DataFolder.get(context)))
}
