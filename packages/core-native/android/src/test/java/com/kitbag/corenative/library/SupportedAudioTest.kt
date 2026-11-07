package com.kitbag.corenative.library

import org.junit.Assert.assertEquals
import org.junit.Test

class SupportedAudioTest {
  @Test
  fun namesEachFamilyTheCoreDecodesOnce() {
    assertEquals(listOf("WAV", "MP3", "FLAC", "AIFF", "W64"), SupportedAudio.FAMILY_NAMES)
  }

  @Test
  fun flattensTheFamiliesIntoExtensionsAndMimeTypes() {
    assertEquals(
      listOf("wav", "rf64", "mp3", "flac", "aiff", "aif", "aifc", "w64"),
      SupportedAudio.EXTENSIONS,
    )
    assertEquals(
      listOf(
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/vnd.wave",
        "audio/mpeg",
        "audio/mp3",
        "audio/mpeg3",
        "audio/x-mpeg",
        "audio/x-mp3",
        "audio/mpg",
        "audio/flac",
        "audio/x-flac",
        "audio/aiff",
        "audio/x-aiff",
        "audio/aifc",
        "audio/x-aifc",
      ),
      SupportedAudio.MIME_TYPES,
    )
  }

  @Test
  fun thePickerOffersSupportedAudioAndStemBundleZipsOnly() {
    assertEquals(
      SupportedAudio.MIME_TYPES + listOf("application/zip", "application/x-zip-compressed"),
      DocumentPicker.PICKABLE_MIME_TYPES.toList(),
    )
  }
}
