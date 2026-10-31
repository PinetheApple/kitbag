package com.kitbag.corenative.library

import android.content.ContentResolver
import android.net.Uri
import android.os.StatFs
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File

class StemBundleBridge(private val resolver: ContentResolver, private val base: File) {
  private val importer by lazy {
    StemBundleImporter(
      base = base,
      maxStems = NativeStemBundle.maxStems,
      availableBytes = { StatFs(it.path).availableBytes },
      sidecars = NativeStemBundle,
      warn = { message, cause -> Log.w(TAG, message, cause) },
    )
  }

  fun check(uri: String, isFolder: Boolean): WritableMap =
    StemBundleMaps.check(importer.check(source(uri, isFolder)), NativeStemBundle.maxStems)

  fun import(uri: String, isFolder: Boolean): WritableMap =
    StemBundleMaps.imported(importer.import(source(uri, isFolder)))

  fun clearStaging() = importer.clearStaging()

  fun stemFolderNames(): WritableArray =
    Arguments.createArray().apply {
      File(base, LibraryPaths.STEMS_DIR_NAME)
        .listFiles { file -> file.isDirectory && !LibraryPaths.isHiddenName(file.name) }
        .orEmpty()
        .forEach { pushString(it.name) }
    }

  private fun source(uri: String, isFolder: Boolean) = BundleSources.open(resolver, Uri.parse(uri), isFolder)

  companion object {
    private const val TAG = "KitbagStemBundle"

    val CONSTANTS: Map<String, Any> = mapOf(
      "bundleRefusalNotABundle" to StemBundleRefusal.NOT_A_BUNDLE,
      "bundleRefusalVersion" to StemBundleRefusal.UNSUPPORTED_VERSION,
      "bundleRefusalTooManyStems" to StemBundleRefusal.TOO_MANY_STEMS,
      "bundleRefusalUnreadable" to StemBundleRefusal.UNREADABLE,
      "bundleRefusalNoSpace" to StemBundleRefusal.NO_SPACE,
    )
  }
}
