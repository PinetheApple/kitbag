package com.kitbag.corenative.library.move

import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class MovePlanTest {
  private lateinit var temp: File
  private lateinit var fx: MoveFixture

  @Before
  fun setUp() {
    temp = Files.createTempDirectory("move-plan").toFile()
    fx = MoveFixture(temp)
  }

  @After
  fun tearDown() {
    temp.deleteRecursively()
  }

  @Test
  fun `only visible song and stem files are planned, relative and sorted`() {
    val library = fx.seedLibrary(fx.internalRoot)
    val plan = MovePlan.scan(fx.internalRoot)
    assertEquals(library.keys.sorted(), plan.map { it.path })
    plan.forEach { assertEquals(it.path, library.getValue(it.path).size.toLong(), it.size) }
  }

  @Test
  fun `an empty root plans nothing`() {
    assertEquals(emptyList<MoveSourceFile>(), MovePlan.scan(fx.internalRoot))
  }
}
