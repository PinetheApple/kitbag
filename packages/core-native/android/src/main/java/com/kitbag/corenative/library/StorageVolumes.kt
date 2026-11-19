package com.kitbag.corenative.library

import android.content.Context
import android.os.Environment
import android.os.StatFs
import android.os.storage.StorageManager
import java.io.File

data class PortableVolume(val uuid: String, val filesDir: File, val mounted: Boolean, val freeBytes: Long)

interface VolumeProvider {
  fun portable(): List<PortableVolume>

  fun find(uuid: String): PortableVolume? = portable().firstOrNull { it.uuid == uuid }
}

class AndroidVolumes(private val context: Context) : VolumeProvider {
  override fun portable(): List<PortableVolume> {
    val storage = context.getSystemService(StorageManager::class.java)
    return context.getExternalFilesDirs(null).filterNotNull().mapNotNull { dir ->
      val volume = storage.getStorageVolume(dir) ?: return@mapNotNull null
      val uuid = volume.uuid
      if (volume.isPrimary || !volume.isRemovable || uuid == null) return@mapNotNull null
      val mounted = volume.state == Environment.MEDIA_MOUNTED
      PortableVolume(uuid, dir, mounted, if (mounted) StatFs(dir.path).availableBytes else 0L)
    }
  }
}
