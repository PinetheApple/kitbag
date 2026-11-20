package com.kitbag.corenative.library

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MigrationCopiesTest {
  private lateinit var folder: File
  private lateinit var database: File
  private val synced = mutableListOf<String>()

  private val recordingSync = object : DiskSync {
    override fun file(output: FileOutputStream) {
      synced += "file"
    }

    override fun directory(dir: File) {
      synced += "dir:${dir.name}"
    }
  }

  @Before
  fun setUp() {
    folder = Files.createTempDirectory("databases").toFile()
    database = File(folder, DATABASE).apply { writeText("live") }
  }

  @After
  fun tearDown() {
    folder.deleteRecursively()
  }

  private fun copies(rename: (File, File) -> Boolean = File::renameTo) = MigrationCopies(database, recordingSync, rename)

  private fun file(name: String, contents: String) = File(folder, name).apply { writeText(contents) }

  @Test
  fun `replace syncs the part, moves it over the previous copy, then syncs the folder`() {
    file(PART, "new")
    file(COPY, "old")
    copies().replace(PART, COPY)
    assertEquals("new", File(folder, COPY).readText())
    assertFalse(File(folder, PART).exists())
    assertEquals(listOf("file", "dir:${folder.name}"), synced)
  }

  @Test
  fun `a failed move leaves the previous copy as it was`() {
    file(PART, "new")
    file(COPY, "old")
    assertThrows(IOException::class.java) { copies { _, _ -> false }.replace(PART, COPY) }
    assertEquals("old", File(folder, COPY).readText())
  }

  @Test
  fun `replace refuses a missing part without creating it`() {
    assertThrows(IOException::class.java) { copies().replace(PART, COPY) }
    assertFalse(File(folder, PART).exists())
  }

  @Test
  fun `remove deletes a copy and accepts one that is already gone`() {
    file(COPY, "old")
    copies().remove(COPY)
    copies().remove(COPY)
    assertFalse(File(folder, COPY).exists())
  }

  @Test
  fun `names that are not copies of the database are refused`() {
    val journal = file("$DATABASE-journal", "hot")
    listOf(DATABASE, journal.name, "../$COPY", "other.v24.bak", "$DATABASE./x").forEach { name ->
      assertThrows(IllegalArgumentException::class.java) { copies().remove(name) }
    }
    assertTrue(database.exists())
    assertTrue(journal.exists())
  }

  private companion object {
    const val DATABASE = "kitbag"
    const val COPY = "kitbag.v24.bak"
    const val PART = "kitbag.v24.bak.part"
  }
}
