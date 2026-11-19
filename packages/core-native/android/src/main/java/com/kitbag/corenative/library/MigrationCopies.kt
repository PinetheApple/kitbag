package com.kitbag.corenative.library

import com.kitbag.corenative.library.move.DataFolderMoves
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class MigrationCopies(
  private val database: File,
  private val disk: DiskSync = SystemDiskSync,
  private val rename: (File, File) -> Boolean = File::renameTo,
) {
  private val folder: File = database.absoluteFile.parentFile ?: throw IOException("No folder for ${database.name}")

  fun freeBytes(): Long = DataFolderMoves.usableBytes(folder)

  fun remove(fileName: String) {
    val file = copyFile(fileName)
    if (!file.delete() && file.exists()) throw IOException("Could not remove $fileName")
  }

  fun replace(partName: String, fileName: String) {
    val part = copyFile(partName)
    val target = copyFile(fileName)
    if (!part.isFile) throw IOException("No copy at $partName")
    FileOutputStream(part, true).use(disk::file)
    if (!rename(part, target)) throw IOException("Could not move $partName to $fileName")
    disk.directory(folder)
  }

  // Only names beside the database that extend its own, so neither it nor its journal can be touched.
  private fun copyFile(fileName: String): File {
    require(fileName.startsWith(database.name + ".") && File(fileName).name == fileName) {
      "Not a copy of ${database.name}: $fileName"
    }
    return File(folder, fileName)
  }
}
