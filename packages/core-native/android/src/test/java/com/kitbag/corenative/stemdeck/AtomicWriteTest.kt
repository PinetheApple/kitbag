package com.kitbag.corenative.stemdeck

import com.kitbag.corenative.library.DiskSync
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class AtomicWriteTest {
  private class RecordingSync : DiskSync {
    val synced = mutableListOf<String>()

    override fun file(output: FileOutputStream) {
      synced.add(FILE)
    }

    override fun directory(dir: File) {
      synced.add(dir.name)
    }
  }

  private lateinit var temp: File
  private val sync = RecordingSync()

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("atomic-write").toFile()
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  @Test
  fun `a durable write syncs the file and then its folder`() {
    val target = File(temp, "state.json")
    writeAtomically(target, "{}", durable = true, disk = sync)
    assertEquals("{}", target.readText())
    assertEquals(listOf(FILE, temp.name), sync.synced)
  }

  @Test
  fun `a plain write syncs nothing`() {
    val target = File(temp, "queue.json")
    writeAtomically(target, "[]", disk = sync)
    assertEquals("[]", target.readText())
    assertEquals(emptyList<String>(), sync.synced)
  }

  private companion object {
    const val FILE = "file"
  }
}
