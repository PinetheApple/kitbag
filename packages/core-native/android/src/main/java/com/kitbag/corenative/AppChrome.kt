package com.kitbag.corenative

import android.app.Activity
import android.app.UiModeManager
import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.content.pm.PackageInfoCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.UiThreadUtil

internal object AppChrome {
  private const val TAG = "KitbagAppChrome"
  private const val NO_PACKAGE_FLAGS = 0

  const val NIGHT_MODE_SYSTEM = "system"
  const val NIGHT_MODE_DARK = "dark"
  const val NIGHT_MODE_LIGHT = "light"

  val CONSTANTS: Map<String, Any> =
    mapOf(
      "nightModeSystem" to NIGHT_MODE_SYSTEM,
      "nightModeDark" to NIGHT_MODE_DARK,
      "nightModeLight" to NIGHT_MODE_LIGHT,
    )

  fun version(context: Context): Map<String, Any> {
    val info = packageInfo(context)
    return mapOf(
      "versionName" to info.versionName.orEmpty(),
      "versionCode" to PackageInfoCompat.getLongVersionCode(info).toDouble(),
    )
  }

  fun setNightMode(context: Context, mode: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val uiMode = uiModeManagerMode(mode) ?: return unknownMode(mode)
      context.getSystemService(UiModeManager::class.java).setApplicationNightMode(uiMode)
    } else {
      val appCompatMode = appCompatMode(mode) ?: return unknownMode(mode)
      UiThreadUtil.runOnUiThread { AppCompatDelegate.setDefaultNightMode(appCompatMode) }
    }
  }

  fun setSystemBarAppearance(activity: Activity?, light: Boolean) {
    activity ?: return
    activity.runOnUiThread {
      WindowInsetsControllerCompat(activity.window, activity.window.decorView).apply {
        isAppearanceLightStatusBars = light
        isAppearanceLightNavigationBars = light
      }
    }
  }

  private fun packageInfo(context: Context): PackageInfo {
    val packageManager = context.packageManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val flags = PackageManager.PackageInfoFlags.of(NO_PACKAGE_FLAGS.toLong())
      packageManager.getPackageInfo(context.packageName, flags)
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageInfo(context.packageName, NO_PACKAGE_FLAGS)
    }
  }

  // UiModeManager reads MODE_NIGHT_AUTO per app as "follow the system".
  private fun uiModeManagerMode(mode: String): Int? =
    when (mode) {
      NIGHT_MODE_SYSTEM -> UiModeManager.MODE_NIGHT_AUTO
      NIGHT_MODE_DARK -> UiModeManager.MODE_NIGHT_YES
      NIGHT_MODE_LIGHT -> UiModeManager.MODE_NIGHT_NO
      else -> null
    }

  private fun appCompatMode(mode: String): Int? =
    when (mode) {
      NIGHT_MODE_SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
      NIGHT_MODE_DARK -> AppCompatDelegate.MODE_NIGHT_YES
      NIGHT_MODE_LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
      else -> null
    }

  private fun unknownMode(mode: String) {
    Log.w(TAG, "Ignoring unknown night mode: $mode")
  }
}
