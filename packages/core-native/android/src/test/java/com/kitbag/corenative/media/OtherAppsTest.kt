package com.kitbag.corenative.media

import org.junit.Assert.assertEquals
import org.junit.Test

class OtherAppsTest {
  private data class Session(val packageName: String)

  @Test
  fun `drops every session this app publishes and keeps the rest in order`() {
    val sessions = listOf(Session(MUSIC), Session(OWN), Session(PODCASTS), Session(OWN))

    assertEquals(listOf(Session(MUSIC), Session(PODCASTS)), sessions.fromOtherApps(OWN) { it.packageName })
  }

  @Test
  fun `only this app's sessions leaves nothing to follow`() {
    assertEquals(emptyList<Session>(), listOf(Session(OWN)).fromOtherApps(OWN) { it.packageName })
  }

  private companion object {
    const val OWN = "com.kitbag.app"
    const val MUSIC = "org.example.music"
    const val PODCASTS = "org.example.podcasts"
  }
}
