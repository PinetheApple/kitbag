package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DurableFiles
import com.kitbag.corenative.library.LibraryPaths
import com.kitbag.corenative.library.SystemDiskSync
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

internal object MoveFiles {
  private const val PROBE_FILE_NAME = ".move-probe"
  private val PROBE_BYTES = "kitbag".toByteArray()

  fun canWrite(targetRoot: File): Boolean {
    val probe = File(targetRoot, PROBE_FILE_NAME)
    return try {
      if (!targetRoot.isDirectory && !targetRoot.mkdirs()) return false
      FileOutputStream(probe).use { output ->
        output.write(PROBE_BYTES)
        SystemDiskSync.file(output)
      }
      probe.readBytes().contentEquals(PROBE_BYTES)
    } catch (e: IOException) {
      false
    } finally {
      probe.delete()
    }
  }

  fun deleteCopy(root: File, relativePath: String) {
    val file = LibraryPaths.resolve(root, relativePath)
    DurableFiles.partOf(file).delete()
    if (file.exists() && !file.delete()) throw IOException("Could not delete $relativePath")
    pruneEmptyParents(root.canonicalFile, file.parentFile)
  }

  private fun pruneEmptyParents(root: File, from: File?) {
    var dir = from
    while (dir != null && dir != root && dir.parentFile != root && dir.list()?.isEmpty() == true) {
      dir.delete()
      dir = dir.parentFile
    }
  }
}
