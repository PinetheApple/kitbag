package com.kitbag.corenative.stemdeck

interface FreeSpace {
  fun downloadBytes(): Long

  fun libraryBytes(): Long

  fun sameVolume(): Boolean
}

class SpaceVerdict(val fits: Boolean, val neededBytes: Long, val freeBytes: Long)

class DownloadSpace(private val space: FreeSpace, private val marginBytes: Long = MARGIN_BYTES) {
  // The import copies every stem out of the zip while the zip still exists.
  fun forLength(lengthBytes: Long): SpaceVerdict {
    val downloadFree = space.downloadBytes()
    if (space.sameVolume()) {
      val needed = COPIES_ON_ONE_VOLUME * lengthBytes + marginBytes
      return SpaceVerdict(downloadFree >= needed, needed, downloadFree)
    }
    val needed = lengthBytes + marginBytes
    val libraryFree = space.libraryBytes()
    val tighter = minOf(downloadFree, libraryFree)
    return SpaceVerdict(tighter >= needed, needed, tighter)
  }

  fun whileStreaming(writtenBytes: Long): SpaceVerdict {
    val downloadFree = space.downloadBytes()
    return SpaceVerdict(downloadFree >= marginBytes, writtenBytes + marginBytes, downloadFree)
  }

  fun recheckDue(writtenBytes: Long, checkedAtBytes: Long) = writtenBytes - checkedAtBytes >= RECHECK_BYTES

  companion object {
    private const val MIB = 1024L * 1024L
    const val MARGIN_BYTES = 64 * MIB
    const val RECHECK_BYTES = 32 * MIB
    private const val COPIES_ON_ONE_VOLUME = 2
  }
}
