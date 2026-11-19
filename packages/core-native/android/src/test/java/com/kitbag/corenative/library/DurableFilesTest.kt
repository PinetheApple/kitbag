package com.kitbag.corenative.library

import java.io.File
import java.io.InterruptedIOException
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test

class DurableFilesTest {
  private lateinit var temp: File
  private lateinit var internalRoot: File
  private lateinit var cardRoot: File

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("durable-files").toFile()
    internalRoot = File(temp, "internal").apply { mkdirs() }
    cardRoot = File(temp, "card").apply { mkdirs() }
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  private fun staged(contents: String) = File(internalRoot, ".analysis-staging/a.kwav").apply {
    parentFile.mkdirs()
    writeText(contents)
  }

  @Test
  fun `a rename that fails across volumes falls back to copy and delete`() {
    val source = staged("peaks")
    val target = File(cardRoot, "songs/a/a.kwav").apply {
      parentFile.mkdirs()
      writeText("old peaks")
    }
    DurableFiles.move(source, target) { _, _ -> false }
    assertEquals("peaks", target.readText())
    assertFalse(source.exists())
    assertFalse(DurableFiles.partOf(target).exists())
  }

  @Test
  fun `a rename that works is used as is`() {
    val source = staged("peaks")
    val target = File(cardRoot, "a.kwav")
    var renamed = false
    DurableFiles.move(source, target) { from, to -> from.renameTo(to).also { renamed = it } }
    assertEquals(true, renamed)
    assertEquals("peaks", target.readText())
  }

  @Test
  fun `a copy reports the SHA-256 of what it copied`() {
    val target = File(cardRoot, "songs/a/a.mp3")
    assertEquals(ABC_SHA256, DurableFiles.copyAndHash(staged("abc"), target))
    assertEquals(ABC_SHA256, DurableFiles.sha256(target))
  }

  @Test
  fun `an interrupted copy leaves no target and no part`() {
    val target = File(cardRoot, "a.mp3")
    assertThrows(InterruptedIOException::class.java) { DurableFiles.copyAndHash(staged("abc"), target) { true } }
    assertFalse(target.exists())
    assertFalse(DurableFiles.partOf(target).exists())
  }

  private companion object {
    const val ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  }
}
