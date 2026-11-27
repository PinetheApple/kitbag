package com.kitbag.corenative.library

import com.kitbag.corenative.library.move.MoveFailure
import com.kitbag.corenative.library.move.MoveRefusal

object LibraryErrors {
  const val NO_ACTIVITY = "E_NO_ACTIVITY"
  const val PICK_IN_PROGRESS = "E_PICK_IN_PROGRESS"
  const val NO_PICKER = "E_NO_PICKER"
  const val PICK_FAILED = "E_PICK_FAILED"
  const val SHARED_BACKUP_UNREADABLE = "E_SHARED_BACKUP_UNREADABLE"
  const val INVALIDATED = "E_INVALIDATED"
  const val BAD_FILE_NAME = "E_BAD_FILE_NAME"
  const val NO_SHARE_TARGET = "E_NO_SHARE_TARGET"
  const val SHARE_FAILED = "E_SHARE_FAILED"
  const val SAVE_FAILED = "E_SAVE_FAILED"
  const val DATABASE_COPY_NO_SPACE = "E_DATABASE_COPY_NO_SPACE"
  const val DATABASE_COPY_UNREADABLE = "E_DATABASE_COPY_UNREADABLE"
  const val DATA_FOLDER_UNAVAILABLE = "E_DATA_FOLDER_UNAVAILABLE"

  val EXPORT_CONSTANTS: Map<String, Any> = mapOf(
    "exportBadFileName" to BAD_FILE_NAME,
    "exportNoActivity" to NO_ACTIVITY,
    "exportNoShareTarget" to NO_SHARE_TARGET,
    "exportShareFailed" to SHARE_FAILED,
  )

  val DATABASE_COPY_CONSTANTS: Map<String, Any> = mapOf(
    "databaseCopyNoSpace" to DATABASE_COPY_NO_SPACE,
    "databaseCopyUnreadable" to DATABASE_COPY_UNREADABLE,
  )

  fun databaseCopyCode(error: Throwable): String =
    when (error) {
      is DatabaseCopyNoSpaceException -> DATABASE_COPY_NO_SPACE
      is DatabaseCopyUnreadableException -> DATABASE_COPY_UNREADABLE
      else -> SAVE_FAILED
    }

  private const val MOVE_PREFIX = "E_MOVE_"
  private const val MOVE_ERRORS = "moveErrors"

  fun moveCode(failure: MoveFailure): String = MOVE_PREFIX + failure.name

  fun moveCode(refusal: MoveRefusal): String = MOVE_PREFIX + refusal.name

  val MOVE_CONSTANTS: Map<String, Any> = mapOf(
    MOVE_ERRORS to MoveFailure.values().associate { camelCase(it.name) to moveCode(it) } +
      MoveRefusal.values().associate { camelCase(it.name) to moveCode(it) },
  )

  fun camelCase(enumName: String): String =
    enumName.lowercase().split('_').mapIndexed { i, word -> if (i == 0) word else word.replaceFirstChar(Char::uppercase) }
      .joinToString("")

  fun codeFor(error: Throwable, fallback: String): String =
    if (generateSequence(error) { it.cause }.any { it is DataFolderUnavailableException }) {
      DATA_FOLDER_UNAVAILABLE
    } else {
      fallback
    }
}
