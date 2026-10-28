package com.kitbag.corenative.library

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import java.io.IOException

object BundleSources {
  fun open(resolver: ContentResolver, uri: Uri, isFolder: Boolean): BundleSource {
    if (isFolder) return DocumentTreeBundleSource(resolver, uri)
    return ZipBundleSource(documentSize(resolver, uri)) {
      resolver.openInputStream(uri) ?: throw IOException("Could not open $uri")
    }
  }

  private fun documentSize(resolver: ContentResolver, uri: Uri): Long =
    resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
      ?.use { cursor -> if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null }
      ?: BundleSource.UNKNOWN_SIZE
}
