package com.kitbag.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * SKELETON (#31) — registration seam for @kitbag/core-native's native surface.
 *
 * When fully wired (#33, on-device), this is where two things attach to the RN
 * runtime, keeping both on the single kb_engine* the HostObject owns (SPEC
 * §4.5):
 *   1. The JSI HostObject install (kitbag::kitbagInstall in libkitbag_jsi.so) —
 *      the polled 60fps read path (§13.3). It needs the JSI runtime handle /
 *      RuntimeExecutor, which is only available inside a live host.
 *   2. The KitbagCommands TurboModule (§13.2) generated from
 *      NativeKitbagCommands.ts, routing each command to kitbag::command*.
 *
 * Compile-shaped only: returns empty lists so it is safe to add to the package
 * list today without claiming either path works. DEFERRED to #33 because the
 * runtime-handle plumbing (System.loadLibrary + JSI install) cannot be exercised
 * off-device, and the codegen'd TurboModule base class does not exist until a
 * Gradle build runs codegen.
 */
class KitbagCorePackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = emptyList()

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
