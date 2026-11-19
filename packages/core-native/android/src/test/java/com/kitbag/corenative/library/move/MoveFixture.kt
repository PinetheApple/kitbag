package com.kitbag.corenative.library.move

import com.kitbag.corenative.library.DataFolder
import com.kitbag.corenative.library.DataFolderLocation
import com.kitbag.corenative.library.DurableFiles
import com.kitbag.corenative.library.PortableVolume
import com.kitbag.corenative.library.VolumeProvider
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.random.Random

class MoveFixture(temp: File) {
  class FakeVolumes(var volumes: List<PortableVolume>) : VolumeProvider {
    override fun portable() = volumes
  }

  class Killed : RuntimeException()

  val filesDir = File(temp, "files").apply { mkdirs() }
  val cardFilesDir = File(temp, "card").apply { mkdirs() }
  val volumes = FakeVolumes(listOf(card(mounted = true)))
  val warnings = mutableListOf<String>()
  val journalFile = File(filesDir, MoveJournal.FILE_NAME)
  var folder = newFolder()
  var released = true
  var freeBytes = Long.MAX_VALUE

  val internalRoot get() = File(filesDir, DataFolder.DIR_NAME)
  val cardRoot get() = File(cardFilesDir, DataFolder.DIR_NAME)

  fun card(mounted: Boolean) = PortableVolume(CARD_UUID, cardFilesDir, mounted)

  fun newFolder() = DataFolder(filesDir, volumes) { message, _ -> warnings.add(message) }

  fun runner(listener: (MoveProgress) -> Unit = {}) =
    MoveRunner(folder, MoveJournal(journalFile) { message, _ -> warnings.add(message) }, { freeBytes }, { released }, listener)

  fun newProcess(): MoveRunner {
    folder = newFolder()
    return runner()
  }

  fun seedLibrary(root: File): Map<String, ByteArray> {
    val library = linkedMapOf(
      SONG to Random(SEED).nextBytes(MULTI_BUFFER_BYTES),
      WAVEFORM to "peaks".toByteArray(),
      DRUMS to "drums".toByteArray(),
      BASS to "bass".toByteArray(),
    )
    library.forEach { (path, bytes) -> write(root, path, bytes) }
    EXCLUDED.forEach { write(root, it, "private".toByteArray()) }
    return library
  }

  fun write(root: File, relativePath: String, bytes: ByteArray) =
    File(root, relativePath).apply {
      parentFile.mkdirs()
      writeBytes(bytes)
    }

  fun hashes(library: Map<String, ByteArray>): Map<String, String> =
    library.mapValues { (_, bytes) -> DurableFiles.sha256(bytes) }

  fun visibleFiles(root: File): Map<String, String> =
    MovePlan.scan(root).associate { it.path to DurableFiles.sha256(File(root, it.path)) }

  fun location(): DataFolderLocation = folder.location()

  fun readerCanEnter(): Boolean {
    var entered = false
    val reader = Thread {
      val lock = folder.importLock.readLock()
      entered = lock.tryLock(0, TimeUnit.MILLISECONDS)
      if (entered) lock.unlock()
    }
    reader.start()
    reader.join()
    return entered
  }

  companion object {
    const val CARD_UUID = "1234-ABCD"
    const val SONG = "songs/a/a.mp3"
    const val WAVEFORM = "songs/a/a.kwav"
    const val DRUMS = "stems/job1/drums.wav"
    const val BASS = "stems/job1/bass.wav"
    const val IMPORTED = "songs/b/b.mp3"
    val EXCLUDED = listOf(
      ".analysis-staging/x.kwav",
      ".analysis-results/y.result",
      "songs/c/.c.mp3.part",
      "stems/.import-staging/z.wav",
      "kitbag.db",
    )
    private const val SEED = 7
    private const val MULTI_BUFFER_BYTES = 200 * 1024
  }
}
