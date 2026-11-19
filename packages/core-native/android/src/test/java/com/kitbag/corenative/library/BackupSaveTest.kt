package com.kitbag.corenative.library

import android.content.Intent
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.io.RandomAccessFile
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupSaveTest {
  private val opened = mutableListOf<String>()
  private val discarded = mutableListOf<String>()
  private val written = ByteArrayOutputStream()
  private val open: (String, String) -> OutputStream? = { uri, _ -> opened += uri; written }
  private val discard: (String) -> Unit = { discarded += it }

  private fun complete(saved: Boolean = true, pickedUri: String? = PICKED, opener: (String, String) -> OutputStream? = open) =
    BackupSave.complete(saved, pickedUri, CONTENTS, opener, discard)

  @Test
  fun `saves the contents as UTF-8 bytes`() {
    assertTrue(complete())

    assertArrayEquals(CONTENTS.toByteArray(Charsets.UTF_8), written.toByteArray())
    assertTrue(discarded.isEmpty())
  }

  @Test
  fun `a cancelled dialog writes nothing, even when it hands back a document`() {
    assertFalse(complete(saved = false))

    assertTrue(opened.isEmpty())
    assertEquals(0, written.size())
  }

  @Test
  fun `writes only to the document the user picked`() {
    complete()

    assertEquals(listOf(PICKED), opened)
  }

  @Test
  fun `the dialog suggests a name and no starting folder`() {
    assertEquals(mapOf(Intent.EXTRA_TITLE to NAME), BackupSave.dialogExtras(NAME))
  }

  @Test
  fun `a shorter backup over a longer file leaves no trailing bytes`() {
    val target = File.createTempFile("kitbag", ".json").apply { deleteOnExit() }
    target.writeText(CONTENTS.repeat(3))

    complete(opener = { _, mode -> providerStream(target, mode) })

    assertArrayEquals(CONTENTS.toByteArray(Charsets.UTF_8), target.readBytes())
  }

  @Test
  fun `a document that cannot be opened is deleted and fails rather than reporting saved`() {
    assertThrows(IOException::class.java) { complete(opener = { _, _ -> null }) }

    assertEquals(listOf(PICKED), discarded)
  }

  @Test
  fun `a write that fails part way deletes the created document`() {
    val failing = object : OutputStream() {
      override fun write(b: Int) = throw IOException("disk full")
    }

    assertThrows(IOException::class.java) { complete(opener = { _, _ -> failing }) }

    assertEquals(listOf(PICKED), discarded)
  }

  @Test
  fun `a failed delete does not hide the write failure`() {
    val error = assertThrows(IOException::class.java) {
      BackupSave.complete(true, PICKED, CONTENTS, { _, _ -> null }) { throw SecurityException("no delete") }
    }

    assertEquals("Could not open the chosen document", error.message)
  }

  @Test
  fun `a saved result without a document fails`() {
    assertThrows(IOException::class.java) { complete(pickedUri = null) }
    assertTrue(opened.isEmpty())
  }

  private fun providerStream(file: File, mode: String): OutputStream {
    val raf = RandomAccessFile(file, "rw")
    if (TRUNCATE in mode) raf.setLength(0)
    return object : OutputStream() {
      override fun write(b: Int) = raf.write(b)
      override fun write(b: ByteArray, off: Int, len: Int) = raf.write(b, off, len)
      override fun close() = raf.close()
    }
  }

  private companion object {
    const val NAME = "kitbag_export.json"
    const val PICKED = "content://com.android.providers.downloads.documents/document/42"
    const val CONTENTS = "{\"setlists\":[{\"name\":\"Café — set 2\"}]}"
    const val TRUNCATE = 't'
  }
}
