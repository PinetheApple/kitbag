package com.kitbag.corenative.library

import android.media.MediaMetadataRetriever
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.io.File

class AudioMetadata(val title: String?, val artist: String?, val durationSec: Double) {
  companion object {
    private const val MILLIS_PER_SECOND = 1000.0

    fun importedAudio(root: File, file: File, displayName: String?): WritableMap {
      val metadata = read(file)
      return Arguments.createMap().apply {
        putString("relativePath", LibraryPaths.relativize(root, file))
        putString("title", metadata.title ?: LibraryPaths.displayTitle(displayName) ?: file.nameWithoutExtension)
        putString("artist", metadata.artist.orEmpty())
        putDouble("durationSec", metadata.durationSec)
      }
    }

    fun read(file: File): AudioMetadata {
      val retriever = MediaMetadataRetriever()
      return try {
        retriever.setDataSource(file.path)
        AudioMetadata(
          title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() },
          artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() },
          durationSec = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            ?.toLongOrNull()?.let { it / MILLIS_PER_SECOND } ?: 0.0,
        )
      } catch (e: RuntimeException) {
        AudioMetadata(null, null, 0.0)
      } finally {
        retriever.release()
      }
    }
  }
}
