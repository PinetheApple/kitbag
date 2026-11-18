package com.kitbag.corenative.stemdeck

import java.io.File
import java.io.IOException

fun writeAtomically(file: File, text: String) {
  val dir = file.parentFile ?: throw IOException("No folder for ${file.name}")
  if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create ${dir.name}")
  val temp = File(dir, ".${file.name}.part")
  try {
    temp.writeText(text)
    if (!temp.renameTo(file)) throw IOException("Could not store ${file.name}")
  } finally {
    temp.delete()
  }
}
