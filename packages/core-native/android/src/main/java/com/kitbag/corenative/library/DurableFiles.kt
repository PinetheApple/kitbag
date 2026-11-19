package com.kitbag.corenative.library

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.io.OutputStream
import java.nio.channels.FileChannel
import java.nio.file.StandardOpenOption
import java.security.MessageDigest

interface DiskSync {
  fun file(output: FileOutputStream)

  fun directory(dir: File)
}

object SystemDiskSync : DiskSync {
  // java.nio.file arrived in API 26 and minSdk is 24; older devices skip the directory sync.
  private val directorySyncSupported = try {
    Class.forName("java.nio.file.Path")
    true
  } catch (e: ClassNotFoundException) {
    false
  }

  override fun file(output: FileOutputStream) = output.fd.sync()

  override fun directory(dir: File) {
    if (!directorySyncSupported) return
    try {
      FileChannel.open(dir.toPath(), StandardOpenOption.READ).use { it.force(true) }
    } catch (e: IOException) {
      // Some card filesystems refuse fsync on a directory; the file data is already synced.
    }
  }
}

object DurableFiles {
  private const val BUFFER_BYTES = 64 * 1024
  private const val PART_SUFFIX = ".part"
  private const val DIGEST_ALGORITHM = "SHA-256"

  fun partOf(target: File) = File(target.parentFile, LibraryPaths.HIDDEN_PREFIX + target.name + PART_SUFFIX)

  fun sha256(bytes: ByteArray): String = hex(digest().apply { update(bytes) })

  fun sha256(file: File, interrupted: () -> Boolean = { false }): String {
    val digest = digest()
    file.inputStream().use { input -> pump(input, null, digest, interrupted) }
    return hex(digest)
  }

  fun copyAndHash(source: File, target: File, interrupted: () -> Boolean = { false }): String {
    val dir = target.parentFile ?: throw IOException("No folder for ${target.name}")
    ensureDirectory(dir)
    val part = partOf(target)
    val digest = digest()
    try {
      source.inputStream().use { input ->
        FileOutputStream(part).use { output ->
          pump(input, output, digest, interrupted)
          SystemDiskSync.file(output)
        }
      }
      if (!part.renameTo(target)) throw IOException("Could not move ${target.name} into place")
      SystemDiskSync.directory(dir)
    } finally {
      part.delete()
    }
    return hex(digest)
  }

  fun move(source: File, target: File, rename: (File, File) -> Boolean = File::renameTo) {
    if (rename(source, target)) return
    copyAndHash(source, target)
    if (!source.delete()) throw IOException("Could not remove ${source.name} after copying it")
  }

  private fun ensureDirectory(dir: File) {
    val created = generateSequence(dir) { it.parentFile }.takeWhile { !it.exists() }.toList()
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create $dir")
    created.mapNotNull { it.parentFile }.forEach(SystemDiskSync::directory)
  }

  private fun digest(): MessageDigest = MessageDigest.getInstance(DIGEST_ALGORITHM)

  private fun hex(digest: MessageDigest): String = digest.digest().joinToString("") { "%02x".format(it) }

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
