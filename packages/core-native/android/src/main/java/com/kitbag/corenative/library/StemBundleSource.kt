package com.kitbag.corenative.library

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.zip.ZipInputStream

// Members are named as in the zip ("manifest.json", "stems/vocals.flac") and
// streamed, never loaded whole.
interface BundleSource {
  fun sizeBytes(): Long

  fun <T> withManifest(read: (InputStream?) -> T): T

  // The stream belongs to the source: read it, do not close it.
  fun forEachMember(wanted: (String) -> Boolean, visit: (String, InputStream) -> Unit)

  companion object {
    const val UNKNOWN_SIZE = -1L
  }
}

class ZipBundleSource(private val size: Long, private val open: () -> InputStream) : BundleSource {
  override fun sizeBytes() = size

  // StemDeck writes the manifest first, so this usually stops at entry one.
  override fun <T> withManifest(read: (InputStream?) -> T): T =
    open().use { raw ->
      val zip = ZipInputStream(raw.buffered())
      read(if (seekToManifest(zip)) zip else null)
    }

  private fun seekToManifest(zip: ZipInputStream): Boolean {
    while (true) {
      val entry = zip.nextEntry ?: return false
      if (!entry.isDirectory && entry.name == StemBundleManifest.FILE_NAME) return true
    }
  }

  override fun forEachMember(wanted: (String) -> Boolean, visit: (String, InputStream) -> Unit) {
    open().use { raw ->
      val zip = ZipInputStream(raw.buffered())
      while (true) {
        val entry = zip.nextEntry ?: break
        if (!entry.isDirectory && wanted(entry.name)) visit(entry.name, zip)
      }
    }
  }
}

// At most cap + one buffer is read.
internal fun readCapped(input: InputStream, cap: Int): String? {
  val out = ByteArrayOutputStream()
  val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
  while (true) {
    val n = input.read(buffer)
    if (n < 0) break
    if (out.size() + n > cap) return null
    out.write(buffer, 0, n)
  }
  return out.toString(Charsets.UTF_8.name())
}
