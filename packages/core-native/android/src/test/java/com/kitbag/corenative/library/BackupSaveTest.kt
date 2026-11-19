package com.kitbag.corenative.library

import android.content.Intent
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.OutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupSaveTest {
  private val opened = mutableListOf<String>()
  private val written = ByteArrayOutputStream()
  private val open: (String) -> OutputStream? = { uri -> opened += uri; written }

  @Test
  fun `saves the same bytes the share path writes`() {
    val shared = File.createTempFile("kitbag", ".json").apply { deleteOnExit() }
    shared.outputStream().use { BackupFiles.write(it, CONTENTS) }

    assertTrue(BackupSave.complete(saved = true, PICKED, CONTENTS, open))

    assertArrayEquals(shared.readBytes(), written.toByteArray())
    assertArrayEquals(CONTENTS.toByteArray(Charsets.UTF_8), written.toByteArray())
  }

  @Test
  fun `a cancelled dialog writes nothing, even when it hands back a document`() {
    assertFalse(BackupSave.complete(saved = false, PICKED, CONTENTS, open))

    assertTrue(opened.isEmpty())
    assertEquals(0, written.size())
  }

  @Test
  fun `writes only to the document the user picked`() {
    BackupSave.complete(saved = true, PICKED, CONTENTS, open)

    assertEquals(listOf(PICKED), opened)
  }

  @Test
  fun `the dialog suggests a name and no starting folder`() {
    assertEquals(mapOf(Intent.EXTRA_TITLE to NAME), BackupSave.dialogExtras(NAME))
  }

  @Test
  fun `a document that cannot be opened fails rather than reporting saved`() {
    assertThrows(IOException::class.java) {
      BackupSave.complete(saved = true, PICKED, CONTENTS) { null }
    }
  }

  @Test
  fun `a saved result without a document fails`() {
    assertThrows(IOException::class.java) {
      BackupSave.complete(saved = true, pickedUri = null, CONTENTS, open)
    }
    assertTrue(opened.isEmpty())
  }

  private companion object {
    const val NAME = "kitbag_export.json"
    const val PICKED = "content://com.android.providers.downloads.documents/document/42"
    const val CONTENTS = "{\"setlists\":[{\"name\":\"Café — set 2\"}]}"
  }
}
