package com.kitbag.corenative.library

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import java.io.IOException
import java.io.InputStream

// An extracted bundle under a tree URI from ACTION_OPEN_DOCUMENT_TREE. Only the
// top level and stems/ are listed: the format has nothing deeper.
class DocumentTreeBundleSource(
  private val resolver: ContentResolver,
  private val treeUri: Uri,
) : BundleSource {
  private class Child(val documentId: String, val name: String, val isDirectory: Boolean, val size: Long)

  private val members: Map<String, Child> by lazy {
    val top = children(DocumentsContract.getTreeDocumentId(treeUri))
    val stemsDir = top.firstOrNull { it.isDirectory && "${it.name}/" == StemBundleManifest.STEMS_PREFIX }
    val stems = stemsDir?.let { dir -> children(dir.documentId).map { "${StemBundleManifest.STEMS_PREFIX}${it.name}" to it } }
    (top.map { it.name to it } + stems.orEmpty()).filterNot { it.second.isDirectory }.toMap()
  }

  override fun sizeBytes(): Long =
    if (members.values.any { it.size < 0 }) BundleSource.UNKNOWN_SIZE else members.values.sumOf { it.size }

  override fun <T> withManifest(read: (InputStream?) -> T): T {
    val manifest = members[StemBundleManifest.FILE_NAME] ?: return read(null)
    return open(manifest).use(read)
  }

  override fun forEachMember(wanted: (String) -> Boolean, visit: (String, InputStream) -> Unit) {
    for ((name, child) in members) {
      if (wanted(name)) open(child).use { visit(name, it) }
    }
  }

  private fun open(child: Child): InputStream =
    resolver.openInputStream(DocumentsContract.buildDocumentUriUsingTree(treeUri, child.documentId))
      ?: throw IOException("Could not open ${child.name}")

  private fun children(parentId: String): List<Child> {
    val uri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
    val columns = arrayOf(
      Document.COLUMN_DOCUMENT_ID,
      Document.COLUMN_DISPLAY_NAME,
      Document.COLUMN_MIME_TYPE,
      Document.COLUMN_SIZE,
    )
    val cursor = resolver.query(uri, columns, null, null, null) ?: throw IOException("Could not list the folder")
    return cursor.use {
      buildList {
        while (it.moveToNext()) {
          if (it.isNull(0) || it.isNull(1)) continue
          val size = if (it.isNull(3)) BundleSource.UNKNOWN_SIZE else it.getLong(3)
          add(Child(it.getString(0), it.getString(1), it.getString(2) == Document.MIME_TYPE_DIR, size))
        }
      }
    }
  }
}
