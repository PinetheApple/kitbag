package com.kitbag.corenative.library

// Kept in step with the core's built-in decoders by hand: the C ABI exports no format list.
object SupportedAudio {
  val EXTENSIONS = listOf("wav", "mp3", "flac")
  val MIME_TYPES = listOf(
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/flac",
    "audio/x-flac",
  )
}
