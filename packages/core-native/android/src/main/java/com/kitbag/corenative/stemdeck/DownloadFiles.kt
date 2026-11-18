package com.kitbag.corenative.stemdeck

import java.io.File
import java.io.IOException

class DownloadFiles(val dir: File) {
  fun part(jobId: String) = File(dir, jobId + PART_SUFFIX)

  fun zip(jobId: String) = File(dir, jobId + ZIP_SUFFIX)

  fun prepare() {
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create ${dir.name}")
  }

  fun complete(jobId: String): File {
    val zip = zip(jobId)
    zip.delete()
    if (!part(jobId).renameTo(zip)) throw IOException("Could not finish the download of $jobId")
    return zip
  }

  fun discard(jobId: String) {
    part(jobId).delete()
    zip(jobId).delete()
  }

  fun clearDownloads() {
    dir.listFiles { file -> file.isFile && (file.name.endsWith(PART_SUFFIX) || file.name.endsWith(ZIP_SUFFIX)) }
      .orEmpty()
      .forEach { it.delete() }
  }

  companion object {
    const val DIR_NAME = ".stemdeck-downloads"
    const val PART_SUFFIX = ".zip.part"
    const val ZIP_SUFFIX = ".zip"

    // Set when the StemDeck module starts; until then no file:// bundle is accepted.
    @Volatile var handOffDir: File? = null

    fun isHandOff(file: File, dir: File?): Boolean {
      val inside = dir ?: return false
      val canonical = file.canonicalFile
      return canonical.parentFile == inside.canonicalFile && canonical.name.endsWith(ZIP_SUFFIX)
    }
  }
}
