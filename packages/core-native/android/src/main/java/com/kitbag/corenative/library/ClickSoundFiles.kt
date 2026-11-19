package com.kitbag.corenative.library

import java.io.File
import java.io.IOException

object ClickSoundFiles {
  const val DIR_NAME = "click_sounds"
  const val MAX_BASE_NAME_CHARS = 64
  const val PART_SUFFIX = ".part"
  private const val STAGING_PREFIX = "click-sound-"
  private const val NO_SPACE_ERRNO = "ENOSPC"
  private val FILE_NAME = Regex("[A-Za-z0-9_-]{1,$MAX_BASE_NAME_CHARS}\\.wav")

  fun dir(filesDir: File) = File(filesDir, DIR_NAME)

  fun resolve(filesDir: File, fileName: String): File? =
    if (FILE_NAME.matches(fileName)) File(dir(filesDir), fileName) else null

  fun names(filesDir: File): List<String> =
    dir(filesDir).list().orEmpty().filter { FILE_NAME.matches(it) }.sorted()

  fun write(target: File, bytes: ByteArray) {
    val part = File(target.path + PART_SUFFIX)
    try {
      target.parentFile?.mkdirs()
      part.writeBytes(bytes)
      if (!part.renameTo(target)) throw IOException("Could not move $part into place")
    } finally {
      part.delete()
    }
  }

  fun delete(target: File) {
    if (target.exists() && !target.delete()) throw IOException("Could not delete $target")
  }

  fun staging(cacheDir: File): File = File.createTempFile(STAGING_PREFIX, null, cacheDir)

  // Android names the errno in the message of the IOException a full volume raises.
  fun isNoSpace(error: Throwable): Boolean =
    generateSequence(error) { it.cause }.any { it.message?.contains(NO_SPACE_ERRNO) == true }
}
