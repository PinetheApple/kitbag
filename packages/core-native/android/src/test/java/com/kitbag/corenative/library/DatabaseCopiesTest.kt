package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DatabaseCopiesTest {
  private lateinit var folder: File
  private val warnings = mutableListOf<String>()

  @Before
  fun setUp() {
    folder = Files.createTempDirectory("databases").toFile()
    File(folder, DATABASE).writeText("live")
  }

  @After
  fun tearDown() {
    folder.deleteRecursively()
  }

  private fun copies() = DatabaseCopies({ File(folder, it) }) { message, _ -> warnings += message }

  @Test
  fun `a copy is moved into place and reported done`() {
    File(folder, PART).writeText("new")
    assertTrue(copies().replace(DATABASE, PART, COPY))
    assertEquals("new", File(folder, COPY).readText())
    assertTrue(warnings.isEmpty())
  }

  @Test
  fun `a failed move is reported as false and logged`() {
    assertFalse(copies().replace(DATABASE, PART, COPY))
    assertEquals(1, warnings.size)
  }

  @Test
  fun `a refused name is reported as false and logged`() {
    assertFalse(copies().remove(DATABASE, DATABASE))
    assertTrue(File(folder, DATABASE).exists())
    assertEquals(1, warnings.size)
  }

  @Test
  fun `an unsafe database name is refused by every call`() {
    val unsafe = "../$DATABASE"
    assertEquals(DatabaseCopies.UNMEASURED_BYTES, copies().freeBytes(unsafe), 0.0)
    assertFalse(copies().remove(unsafe, COPY))
    assertFalse(copies().replace(unsafe, PART, COPY))
    assertEquals(3, warnings.size)
  }

  @Test
  fun `free space is measured for a valid database`() {
    assertTrue(copies().freeBytes(DATABASE) >= 0)
  }

  private companion object {
    const val DATABASE = "kitbag"
    const val COPY = "kitbag.v24.bak"
    const val PART = "kitbag.v24.bak.part"
  }
}
