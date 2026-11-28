package com.kitbag.corenative.tools

import android.content.res.AssetManager
import java.io.FileNotFoundException

internal class AssetToolIndexSource(private val assets: AssetManager, private val rules: ToolBundleRules) : ToolIndexSource {
  override fun read(): SignedToolIndex? =
    try {
      SignedToolIndex(asset(rules.indexFile), asset(rules.indexSigFile))
    } catch (error: FileNotFoundException) {
      null
    }

  private fun asset(name: String): ByteArray = assets.open(name).use { it.readBytes() }
}
