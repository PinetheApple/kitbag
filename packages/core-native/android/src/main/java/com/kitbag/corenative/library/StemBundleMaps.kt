package com.kitbag.corenative.library

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

object StemBundleMaps {
  fun check(check: ManifestCheck, maxStems: Int): WritableMap =
    Arguments.createMap().apply {
      putString("refusal", check.refusal)
      putString("format", check.format)
      putInt("version", check.version)
      putInt("supportedVersion", StemBundleManifest.SUPPORTED_VERSION)
      putString("jobId", check.jobId)
      putString("title", check.title)
      putInt("stemCount", check.stemCount)
      putInt("maxStems", maxStems)
    }

  fun imported(bundle: ImportedBundle): WritableMap =
    Arguments.createMap().apply {
      val manifest = bundle.manifest
      val metadata = bundle.metadata
      putString("jobId", manifest.jobId)
      putString("title", manifest.title)
      putString("relativeDir", bundle.relativeDir)
      putDouble("durationSec", manifest.durationSec)
      putInt("sampleRate", manifest.sampleRate)
      putInt("channels", manifest.channels)
      putArray("stems", Arguments.createArray().apply { bundle.stems.forEach { pushMap(stem(it)) } })
      putNullableDouble("bpm", metadata.bpm)
      putString("key", metadata.key)
      putString("scale", metadata.scale)
      putNullableDouble("keyConfidence", metadata.keyConfidence)
      putNullableDouble("loudnessLufs", metadata.loudnessLufs)
      putNullableDouble("tempoStability", metadata.tempoStability)
      putArray("sections", Arguments.createArray().apply { metadata.sections.forEach { pushMap(section(it)) } })
      putArray("beats", Arguments.createArray().apply { bundle.grid.beats.forEach { pushDouble(it) } })
      putArray("bars", Arguments.createArray().apply { bundle.grid.bars.forEach { pushMap(bar(it)) } })
      val lyrics = bundle.lyrics
      if (lyrics == null) putNull("lyrics") else putMap("lyrics", lyrics(lyrics))
    }

  private fun stem(stem: ImportedBundleStem): WritableMap =
    Arguments.createMap().apply {
      putString("name", stem.name)
      putString("relativePath", stem.relativePath)
      putString("waveformRelativePath", stem.waveformRelativePath)
      putDouble("frames", stem.frames.toDouble())
      putDouble("volume", stem.mix.volume)
      putBoolean("muted", stem.mix.muted)
      putBoolean("soloed", stem.mix.soloed)
      putDouble("pitch", stem.mix.pitch)
    }

  private fun section(section: BundleSection): WritableMap =
    Arguments.createMap().apply {
      putString("name", section.name)
      putString("kind", section.kind)
      putString("color", section.color)
      putDouble("startSec", section.startSec)
      putDouble("endSec", section.endSec)
    }

  private fun bar(bar: BundleBar): WritableMap =
    Arguments.createMap().apply {
      putInt("beat", bar.beat)
      putInt("beatsPerBar", bar.beatsPerBar)
    }

  private fun lyrics(lyrics: BundleLyrics): WritableMap =
    Arguments.createMap().apply {
      putString("synced", lyrics.synced)
      putString("plain", lyrics.plain)
      putDouble("offsetSec", lyrics.offsetSec)
      putBoolean("instrumental", lyrics.instrumental)
    }

  private fun WritableMap.putNullableDouble(key: String, value: Double?) {
    if (value == null) putNull(key) else putDouble(key, value)
  }
}
