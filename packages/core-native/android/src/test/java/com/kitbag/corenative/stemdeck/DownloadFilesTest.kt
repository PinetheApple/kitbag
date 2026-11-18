package com.kitbag.corenative.stemdeck

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DownloadFilesTest {
  private lateinit var root: File
  private lateinit var files: DownloadFiles
  private val jobId = "aaaaaaaaaaaa"

  @Before
  fun setUp() {
    root = Files.createTempDirectory("stemdeck-downloads").toFile()
    files = DownloadFiles(File(root, DownloadFiles.DIR_NAME)).apply { prepare() }
  }

  @After
  fun tearDown() {
    root.deleteRecursively()
  }

  @Test
  fun `a finished part becomes the zip, and discard removes both`() {
    files.part(jobId).writeText("zip")
    val zip = files.complete(jobId)
    assertEquals("zip", zip.readText())
    assertFalse(files.part(jobId).exists())
    files.part(jobId).writeText("again")
    files.discard(jobId)
    assertFalse(zip.exists())
    assertFalse(files.part(jobId).exists())
  }

  @Test
  fun `clearing removes every download and keeps the journal`() {
    files.part("bbbbbbbbbbbb").writeText("p")
    files.zip("cccccccccccc").writeText("z")
    File(files.dir, ImportJournal.FILE_NAME).writeText("{}")
    files.clearDownloads()
    assertEquals(listOf(ImportJournal.FILE_NAME), files.dir.list()?.toList())
  }

  @Test
  fun `only a finished zip in the downloads folder may be handed to the import`() {
    val zip = files.zip(jobId).apply { writeText("z") }
    val part = files.part(jobId).apply { writeText("p") }
    val elsewhere = File(root, "$jobId.zip").apply { writeText("z") }
    val escaping = File(files.dir, "../$jobId.zip")
    assertTrue(DownloadFiles.isHandOff(zip, files.dir))
    assertFalse(DownloadFiles.isHandOff(part, files.dir))
    assertFalse(DownloadFiles.isHandOff(elsewhere, files.dir))
    assertFalse(DownloadFiles.isHandOff(escaping, files.dir))
    assertFalse(DownloadFiles.isHandOff(zip, null))
  }

  @Test
  fun `a link in the downloads folder to a zip elsewhere is not a download`() {
    val outside = File(root, "outside.zip").apply { writeText("z") }
    val link = File(files.dir, "$jobId.zip")
    Files.createSymbolicLink(link.toPath(), outside.toPath())
    assertFalse(DownloadFiles.isHandOff(link, files.dir))
    assertFalse(DownloadFiles.isHandOff(File(root, "other/../${DownloadFiles.DIR_NAME}/../outside.zip"), files.dir))
  }
}
