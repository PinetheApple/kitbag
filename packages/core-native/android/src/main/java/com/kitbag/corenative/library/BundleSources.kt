package com.kitbag.corenative.library

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import com.kitbag.corenative.stemdeck.DownloadFiles
import java.io.File
import java.io.FileInputStream
import java.io.IOException

object BundleSources {
  fun open(resolver: ContentResolver, uri: Uri, isFolder: Boolean, handOffDir: File?): BundleSource {
    if (isFolder) return DocumentTreeBundleSource(resolver, uri)
    if (uri.scheme == ContentResolver.SCHEME_FILE) return downloaded(uri, handOffDir)
    return ZipBundleSource(documentSize(resolver, uri)) {
      resolver.openInputStream(uri) ?: throw IOException("Could not open $uri")
    }
  }

  // A file:// bundle is only ever a finished StemDeck download; any other path is refused.
  private fun downloaded(uri: Uri, handOffDir: File?): BundleSource {
    val file = File(uri.path ?: throw IOException("No path in $uri"))
    if (!DownloadFiles.isHandOff(file, handOffDir)) throw IOException("Not a StemDeck download")
    return ZipBundleSource(file.length()) { FileInputStream(file) }
  }

  private fun documentSize(resolver: ContentResolver, uri: Uri): Long =
    resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
      ?.use { cursor -> if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null }
      ?: BundleSource.UNKNOWN_SIZE
}
