package com.kitbag.corenative.library

import java.io.File

object NativeWaveform {
  fun envelope(sidecar: File, buckets: Int): FloatArray? = nativeReadEnvelope(sidecar.path, buckets)

  private external fun nativeReadEnvelope(path: String, buckets: Int): FloatArray?

  init {
    System.loadLibrary("kitbag_jsi")
  }
}
