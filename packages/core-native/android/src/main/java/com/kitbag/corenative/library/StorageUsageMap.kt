package com.kitbag.corenative.library

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

fun StorageUsage.toMap(location: String): WritableMap =
  Arguments.createMap().apply {
    putMap(
      "libraryAudio",
      Arguments.createMap().apply {
        putInt("songs", libraryAudio.songs)
        putDouble("bytes", libraryAudio.bytes.toDouble())
      },
    )
    putMap(
      "stemSets",
      Arguments.createMap().apply {
        putInt("count", stemSets.count)
        putDouble("bytes", stemSets.bytes.toDouble())
      },
    )
    putMap("database", Arguments.createMap().apply { putDouble("bytes", databaseBytes.toDouble()) })
    putString("location", location)
  }
