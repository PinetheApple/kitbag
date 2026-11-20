package com.kitbag.corenative.library

import java.io.File

class DatabaseCopies(
  private val databasePath: (String) -> File,
  private val warn: (String, Exception) -> Unit,
) {
  fun freeBytes(databaseName: String): Double =
    try {
      copies(databaseName).freeBytes().toDouble()
    } catch (e: Exception) {
      warn("Migration copy: could not measure free space for $databaseName", e)
      UNMEASURED_BYTES
    }

  fun remove(databaseName: String, fileName: String): Boolean =
    try {
      copies(databaseName).remove(fileName)
      true
    } catch (e: Exception) {
      warn("Migration copy: could not remove $fileName", e)
      false
    }

  fun replace(databaseName: String, partName: String, fileName: String): Boolean =
    try {
      copies(databaseName).replace(partName, fileName)
      true
    } catch (e: Exception) {
      warn("Migration copy: could not move $partName to $fileName", e)
      false
    }

  private fun copies(databaseName: String): MigrationCopies {
    require(BackupFiles.isSafeDatabaseName(databaseName)) { "Not a database name: $databaseName" }
    return MigrationCopies(databasePath(databaseName))
  }

  companion object {
    const val UNMEASURED_BYTES = -1.0
  }
}
