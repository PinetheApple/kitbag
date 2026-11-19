package com.kitbag.corenative.library

object LibraryErrors {
  const val NO_ACTIVITY = "E_NO_ACTIVITY"
  const val PICK_IN_PROGRESS = "E_PICK_IN_PROGRESS"
  const val NO_PICKER = "E_NO_PICKER"
  const val PICK_FAILED = "E_PICK_FAILED"
  const val INVALIDATED = "E_INVALIDATED"
  const val BAD_FILE_NAME = "E_BAD_FILE_NAME"
  const val NO_SHARE_TARGET = "E_NO_SHARE_TARGET"
  const val SHARE_FAILED = "E_SHARE_FAILED"

  val EXPORT_CONSTANTS: Map<String, Any> = mapOf(
    "exportBadFileName" to BAD_FILE_NAME,
    "exportNoActivity" to NO_ACTIVITY,
    "exportNoShareTarget" to NO_SHARE_TARGET,
    "exportShareFailed" to SHARE_FAILED,
  )
}
