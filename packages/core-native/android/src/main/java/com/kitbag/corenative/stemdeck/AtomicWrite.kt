package com.kitbag.corenative.stemdeck

import com.kitbag.corenative.library.DiskSync
import com.kitbag.corenative.library.SystemDiskSync
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

fun writeAtomically(file: File, text: String, durable: Boolean = false, disk: DiskSync = SystemDiskSync) {
  val dir = file.parentFile ?: throw IOException("No folder for ${file.name}")
  if (!dir.isDirectory && !dir.mkdirs()) throw IOException("Could not create ${dir.name}")
  val temp = File(dir, ".${file.name}.part")
  try {
    if (durable) {
      FileOutputStream(temp).use { output ->
        output.write(text.toByteArray())
        disk.file(output)
      }
    } else {
      temp.writeText(text)
    }
    if (!temp.renameTo(file)) throw IOException("Could not store ${file.name}")
    if (durable) disk.directory(dir)
  } finally {
    temp.delete()
  }
}
