package com.kitbag.corenative.library

class AudioFamily(val name: String, val extensions: List<String>, val mimeTypes: List<String>)

// Kept in step with the core's built-in decoders by hand: the C ABI exports no format list.
object SupportedAudio {
  val FAMILIES = listOf(
    AudioFamily(
      "WAV",
      listOf("wav", "rf64"),
      listOf("audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"),
    ),
    AudioFamily(
      "MP3",
      listOf("mp3"),
      listOf(
        "audio/mpeg",
        "audio/mp3",
        "audio/mpeg3",
        "audio/x-mpeg",
        "audio/x-mp3",
        "audio/mpg",
      ),
    ),
    AudioFamily("FLAC", listOf("flac"), listOf("audio/flac", "audio/x-flac")),
    AudioFamily(
      "AIFF",
      listOf("aiff", "aif", "aifc"),
      listOf("audio/aiff", "audio/x-aiff", "audio/aifc", "audio/x-aifc"),
    ),
    AudioFamily("W64", listOf("w64"), emptyList()),
  )
  val FAMILY_NAMES = FAMILIES.map { it.name }
  val EXTENSIONS = FAMILIES.flatMap { it.extensions }
  val MIME_TYPES = FAMILIES.flatMap { it.mimeTypes }
}
