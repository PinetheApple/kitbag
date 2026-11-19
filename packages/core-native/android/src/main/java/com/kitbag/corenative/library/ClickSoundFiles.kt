package com.kitbag.corenative.library

import java.io.File

object ClickSoundFiles {
  const val DIR_NAME = "click_sounds"
  const val MAX_BASE_NAME_CHARS = 64
  private const val STAGING_PREFIX = "click-sound-"
  private const val NO_SPACE_ERRNO = "ENOSPC"
  private val FILE_NAME = Regex("[A-Za-z0-9_-]{1,$MAX_BASE_NAME_CHARS}\\.wav")

  fun dir(filesDir: File) = File(filesDir, DIR_NAME)

  fun resolve(filesDir: File, fileName: String): File? =
    if (FILE_NAME.matches(fileName)) File(dir(filesDir), fileName) else null

  fun staging(cacheDir: File): File = File.createTempFile(STAGING_PREFIX, null, cacheDir)

  // Android names the errno in the message of the IOException a full volume raises.
  fun isNoSpace(error: Throwable): Boolean =
    generateSequence(error) { it.cause }.any { it.message?.contains(NO_SPACE_ERRNO) == true }
}
