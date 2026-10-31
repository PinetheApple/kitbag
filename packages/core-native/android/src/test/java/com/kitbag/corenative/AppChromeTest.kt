package com.kitbag.corenative

import android.app.UiModeManager
import androidx.appcompat.app.AppCompatDelegate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppChromeTest {
  @Test
  fun `system maps to the follow-system constant on both paths`() {
    assertEquals(UiModeManager.MODE_NIGHT_AUTO, AppChrome.uiModeManagerMode("system"))
    assertEquals(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM, AppChrome.appCompatMode("system"))
  }

  @Test
  fun `dark maps to the night-yes constant on both paths`() {
    assertEquals(UiModeManager.MODE_NIGHT_YES, AppChrome.uiModeManagerMode("dark"))
    assertEquals(AppCompatDelegate.MODE_NIGHT_YES, AppChrome.appCompatMode("dark"))
  }

  @Test
  fun `light maps to the night-no constant on both paths`() {
    assertEquals(UiModeManager.MODE_NIGHT_NO, AppChrome.uiModeManagerMode("light"))
    assertEquals(AppCompatDelegate.MODE_NIGHT_NO, AppChrome.appCompatMode("light"))
  }

  @Test
  fun `unknown mode maps to null on both paths`() {
    assertNull(AppChrome.uiModeManagerMode("sepia"))
    assertNull(AppChrome.appCompatMode("sepia"))
  }
}
