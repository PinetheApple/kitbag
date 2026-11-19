package com.kitbag.corenative.library

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Test

class PerRootTest {
  private val temp = Files.createTempDirectory("per-root").toFile()
  private val created = mutableListOf<File>()
  private val perRoot = PerRoot { root -> Any().also { created.add(root) } }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  @Test
  fun `switching back to a root reuses its instance`() {
    val a = File(temp, "a")
    val b = File(temp, "b")
    val first = perRoot.get(a)
    assertNotSame(first, perRoot.get(b))
    assertSame(first, perRoot.get(a))
    assertEquals(2, created.size)
  }

  @Test
  fun `spellings of one root share an instance`() {
    assertSame(perRoot.get(File(temp, "a")), perRoot.get(File(temp, "a/./x/..")))
  }
}
