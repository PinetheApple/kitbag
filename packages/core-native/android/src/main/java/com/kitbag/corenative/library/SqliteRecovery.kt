package com.kitbag.corenative.library

import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteFullException
import java.io.File

object SqliteRecovery : DatabaseRecovery {
  private val FLAGS = SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.NO_LOCALIZED_COLLATORS
  private const val FIRST_READ = "SELECT count(*) FROM sqlite_master"

  // SQLite rolls a hot journal back, or replays a WAL, no later than the first read of a writable connection.
  override fun recover(database: File) {
    try {
      SQLiteDatabase.openDatabase(database.path, null, FLAGS).use { db ->
        db.rawQuery(FIRST_READ, null).use { it.moveToFirst() }
      }
    } catch (e: SQLiteFullException) {
      throw DatabaseCopyNoSpaceException(e)
    }
  }
}
