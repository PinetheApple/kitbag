package com.kitbag.corenative.library

import java.io.File
import java.io.IOException
import java.util.zip.ZipException

fun interface WaveformSidecarWriter {
  // The sidecar written next to `stem`, or null when it could not be.
  fun write(stem: File, totalFrames: Long, peaks: FloatArray): File?
}

class ImportedBundleStem(
  val name: String,
  val relativePath: String,
  val waveformRelativePath: String,
  val frames: Long,
  val mix: StemMix,
)

class ImportedBundle(
  val manifest: BundleManifest,
  val relativeDir: String,
  val stems: List<ImportedBundleStem>,
  val metadata: BundleMetadata,
  val grid: BundleGrid,
  val lyrics: BundleLyrics?,
)

class StemBundleImporter(
  private val base: File,
  private val maxStems: Int,
  private val availableBytes: (File) -> Long,
  private val sidecars: WaveformSidecarWriter,
  private val warn: BundleWarning,
) {
  private val stemsRoot = File(base, LibraryPaths.STEMS_DIR_NAME)
  private val staging = File(stemsRoot, STAGING_DIR_NAME)
  private val members = StemBundleMembers(warn)

  fun check(source: BundleSource): ManifestCheck {
    val check = try {
      source.withManifest { input ->
        StemBundleManifest.check(input?.let { readCapped(it, MAX_MANIFEST_BYTES) ?: "" }, maxStems)
      }
    } catch (e: ZipException) {
      warn("The bundle is not a readable zip", e)
      return ManifestCheck(StemBundleRefusal.UNREADABLE)
    }
    if (check.refusal != StemBundleRefusal.NONE) return check
    val existing = generateSequence(stemsRoot) { it.parentFile }.first { it.exists() }
    return if (source.sizeBytes() > availableBytes(existing)) check.refused(StemBundleRefusal.NO_SPACE) else check
  }

  @Synchronized
  fun import(source: BundleSource): ImportedBundle {
    staging.deleteRecursively()
    val check = check(source)
    val manifest = check.manifest
    if (check.refusal != StemBundleRefusal.NONE || manifest == null) {
      throw StemBundleRefusedException(check.refusal)
    }
    try {
      if (!staging.mkdirs()) throw IOException("Could not create the import staging directory")
      val texts = copyMembers(source, manifest)
      val names = manifest.stems.map { it.name }
      val waveforms = writeWaveforms(manifest, members.peaks(texts[StemBundleMembers.PEAKS], names))
      val mix = members.mix(texts[StemBundleMembers.MIX], names)
      val metadata = members.metadata(texts[StemBundleMembers.METADATA])
      val grid = members.grid(texts[StemBundleMembers.BEATS])
      val lyrics = members.lyrics(texts[StemBundleMembers.LYRICS])
      val folder = moveIntoPlace(manifest.jobId)
      return ImportedBundle(
        manifest = manifest,
        relativeDir = LibraryPaths.relativize(base, folder),
        stems = manifest.stems.map { stem ->
          ImportedBundleStem(
            name = stem.name,
            relativePath = LibraryPaths.relativize(base, File(folder, stem.fileName)),
            waveformRelativePath = waveforms[stem.name]?.let { LibraryPaths.relativize(base, File(folder, it)) }.orEmpty(),
            frames = stem.frames,
            mix = mix.getValue(stem.name),
          )
        },
        metadata = metadata,
        grid = grid,
        lyrics = lyrics,
      )
    } finally {
      staging.deleteRecursively()
    }
  }

  // Only names the manifest or the format defines are read, and nothing taken
  // from an entry name reaches the disk, so a crafted entry cannot escape.
  private fun copyMembers(source: BundleSource, manifest: BundleManifest): Map<String, String> {
    val stemsByFile = manifest.stems.associateBy { it.file }
    val received = HashSet<String>()
    val texts = HashMap<String, String>()
    val wanted = { name: String ->
      (name in stemsByFile && name !in received) || (name in StemBundleMembers.ALL && name !in texts)
    }
    source.forEachMember(wanted) { name, input ->
      val stem = stemsByFile[name]
      if (stem != null) {
        File(staging, stem.fileName).outputStream().use { input.copyTo(it) }
        received += name
      } else {
        val text = readCapped(input, MAX_MEMBER_BYTES)
        if (text == null) warn("$name is over $MAX_MEMBER_BYTES bytes; treated as absent", null) else texts[name] = text
      }
    }
    val missing = manifest.stems.map { it.file }.filterNot { it in received }
    if (missing.isNotEmpty()) throw IOException("The bundle is missing $missing")
    return texts
  }

  private fun writeWaveforms(manifest: BundleManifest, peaks: Map<String, FloatArray>): Map<String, String> =
    manifest.stems.mapNotNull { stem ->
      val overview = peaks[stem.name] ?: return@mapNotNull null
      val sidecar = sidecars.write(File(staging, stem.fileName), stem.frames, overview)
      if (sidecar == null) warn("No waveform for ${stem.name}", null)
      sidecar?.let { stem.name to it.name }
    }.toMap()

  private fun moveIntoPlace(jobId: String): File {
    val name = LibraryPaths.uniqueFileName(LibraryPaths.safeFileName(jobId, null), stemsRoot.list()?.toList().orEmpty())
    val folder = File(stemsRoot, name)
    if (!staging.renameTo(folder)) throw IOException("Could not move the import into place")
    return folder
  }

  private fun ManifestCheck.refused(refusal: String) =
    ManifestCheck(refusal, format, version, jobId, title, stemCount, manifest)

  companion object {
    // Hidden, so stemFolder() can never name it and it never reads as a stem set.
    const val STAGING_DIR_NAME = ".import-staging"

    // 16 stems fit in a few KB; a manifest past this is not one StemDeck wrote.
    private const val MAX_MANIFEST_BYTES = 256 * 1024

    // peaks.json is ~800 KB for six stems at StemDeck's resolution; this leaves
    // room for sixteen without letting a hostile member exhaust the heap.
    private const val MAX_MEMBER_BYTES = 4 * 1024 * 1024
  }
}
