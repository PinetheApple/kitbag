package com.kitbag.corenative.library

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.io.OutputStream
import java.security.MessageDigest

object DurableFiles {
  private const val BUFFER_BYTES = 64 * 1024
  private const val PART_SUFFIX = ".part"
  private const val DIGEST_ALGORITHM = "SHA-256"

  fun partOf(target: File) = File(target.parentFile, LibraryPaths.HIDDEN_PREFIX + target.name + PART_SUFFIX)

  fun digest(): MessageDigest = MessageDigest.getInstance(DIGEST_ALGORITHM)

  fun hex(digest: MessageDigest): String = digest.digest().joinToString("") { "%02x".format(it) }

  fun sha256(file: File, interrupted: () -> Boolean = { false }): String {
    val digest = digest()
    file.inputStream().use { input -> pump(input, null, digest, interrupted) }
    return hex(digest)
  }

  // Returns the SHA-256 of the bytes read from source; target appears only once they are synced.
  fun copy(source: File, target: File, interrupted: () -> Boolean = { false }): String {
    val dir = target.parentFile ?: throw IOException("No folder for ${target.name}")
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create $dir")
    val part = partOf(target)
    val digest = digest()
    try {
      source.inputStream().use { input ->
        FileOutputStream(part).use { output ->
          pump(input, output, digest, interrupted)
          output.fd.sync()
        }
      }
      if (!part.renameTo(target)) throw IOException("Could not move ${target.name} into place")
    } finally {
      part.delete()
    }
    return hex(digest)
  }

  fun move(source: File, target: File, rename: (File, File) -> Boolean = File::renameTo) {
    if (rename(source, target)) return
    copy(source, target)
    if (!source.delete()) throw IOException("Could not remove ${source.name} after copying it")
  }

  private fun pump(input: InputStream, output: OutputStream?, digest: MessageDigest, interrupted: () -> Boolean) {
    val buffer = ByteArray(BUFFER_BYTES)
    while (true) {
      if (interrupted()) throw InterruptedIOException()
      val read = input.read(buffer)
      if (read < 0) return
      digest.update(buffer, 0, read)
      output?.write(buffer, 0, read)
    }
  }
}
