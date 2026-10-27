package com.kitbag.corenative.library

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.IOException
import java.security.MessageDigest

class AnalysisStore(private val dir: File) {

  fun save(result: AnalysisResult) {
    ensureDir()
    val target = resultFile(result.relativePath)
    val temp = File(dir, ".${target.name}.part")
    try {
      DataOutputStream(temp.outputStream().buffered()).use { result.writeTo(it) }
      if (!temp.renameTo(target)) throw IOException("Could not store the analysis result")
    } finally {
      temp.delete()
    }
  }

  fun pending(): List<AnalysisResult> =
    dir.listFiles { file -> file.name.endsWith(RESULT_SUFFIX) && !file.name.startsWith(".") }
      .orEmpty()
      .mapNotNull { file ->
        try {
          DataInputStream(file.inputStream().buffered()).use { AnalysisResult.readFrom(it) }
        } catch (e: IOException) {
          file.delete()
          null
        }
      }

  fun remove(relativePath: String) {
    resultFile(relativePath).delete()
  }

  // Present only while the core is analysing this song, holding the attempt
  // count; finding it at the start of an attempt means earlier ones died.
  fun markRunning(relativePath: String, attempts: Int) {
    ensureDir()
    runningFile(relativePath).writeText(attempts.toString())
  }

  fun interruptedAttempts(relativePath: String): Int {
    val marker = runningFile(relativePath)
    if (!marker.exists()) return 0
    return marker.readText().trim().toIntOrNull() ?: 1
  }

  fun clearRunning(relativePath: String) {
    runningFile(relativePath).delete()
  }

  private fun ensureDir() {
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create ${dir.name}")
  }

  private fun resultFile(relativePath: String) = File(dir, fileStem(relativePath) + RESULT_SUFFIX)

  private fun runningFile(relativePath: String) = File(dir, fileStem(relativePath) + RUNNING_SUFFIX)

  companion object {
    private const val RESULT_SUFFIX = ".result"
    private const val RUNNING_SUFFIX = ".running"
    private const val WORK_NAME_PREFIX = "kitbag-analysis:"

    fun uniqueWorkName(relativePath: String) = WORK_NAME_PREFIX + relativePath

    fun fileStem(relativePath: String): String =
      MessageDigest.getInstance("SHA-256")
        .digest(relativePath.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
  }
}
