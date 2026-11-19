package com.kitbag.corenative.library

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

fun LibraryAvailability.toMap(): WritableMap =
  Arguments.createMap().apply {
    putArray("missing", Arguments.createArray().apply { missing.forEach(::pushString) })
    putArray("unavailable", Arguments.createArray().apply { unavailable.forEach(::pushString) })
    putBoolean("rootAvailable", rootAvailable)
  }
