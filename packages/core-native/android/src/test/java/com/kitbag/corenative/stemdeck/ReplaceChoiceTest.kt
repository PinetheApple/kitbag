package com.kitbag.corenative.stemdeck

import org.junit.Assert.assertEquals
import org.junit.Test

class ReplaceChoiceTest {
  private val replaceSet = ReplaceChoice(ReplaceMode.REPLACE_SET, 42)
  private val replaceJob = ReplaceChoice(ReplaceMode.REPLACE_JOB)
  private val choices = listOf(ReplaceChoice.ADD, replaceJob, replaceSet)

  @Test
  fun `each choice crosses the bridge as its code and target`() {
    assertEquals(
      listOf(
        ReplaceMode.ADD.code to null,
        ReplaceMode.REPLACE_JOB.code to null,
        ReplaceMode.REPLACE_SET.code to 42.0,
      ),
      choices.map { it.code to it.bridgeTarget },
    )
  }

  @Test
  fun `each choice comes back from the bridge as itself`() {
    assertEquals(choices, choices.map { ReplaceChoice.fromBridge(it.code, it.bridgeTarget) })
  }

  @Test(expected = IllegalArgumentException::class)
  fun `an unknown code is refused`() {
    ReplaceChoice.fromBridge("merge", null)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `a target that is not a whole id is refused`() {
    ReplaceChoice.fromBridge(ReplaceMode.REPLACE_SET.code, 4.5)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `replacing a chosen song needs its target`() {
    ReplaceChoice(ReplaceMode.REPLACE_SET)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `only replacing a chosen song takes a target`() {
    ReplaceChoice(ReplaceMode.ADD, 7)
  }
}
