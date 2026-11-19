package com.kitbag.corenative.library

import java.io.File

class PerRoot<T : Any>(private val create: (File) -> T) {
  private val byRoot = HashMap<File, T>()

  @Synchronized
  fun get(root: File): T = root.canonicalFile.let { key -> byRoot.getOrPut(key) { create(key) } }
}
