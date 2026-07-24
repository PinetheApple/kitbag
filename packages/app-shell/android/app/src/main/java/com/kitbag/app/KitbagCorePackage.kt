package com.kitbag.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registration seam for @kitbag/core-native's native surface.
 *
 * WAS a #31 stub returning empty lists; now (staged for #33, on-device) it
 * registers the KitbagCommands TurboModule (SPEC §13.2). Two things attach to the
 * RN runtime through this package, both kept on the single kb_engine* the
 * HostObject owns (SPEC §4.5):
 *   1. The KitbagCommands TurboModule (getModule below), routing each command to
 *      kitbag::command* via JNI (KitbagJni.cpp).
 *   2. The JSI HostObject install (kitbag::kitbagInstall) — triggered from the
 *      TurboModule's constructor (KitbagCommandsModule.init), because that is the
 *      first point a live JSI runtime handle is available. The 60fps read path
 *      (§13.3) is then completed on the UI runtime from JS (bootstrapRuntime.ts).
 *
 * NOT VERIFIED: this has compiled nowhere. `getReactModuleInfoProvider` /
 * `ReactModuleInfo` arg lists and `BaseReactPackage` are RN-version-sensitive;
 * the ReactModuleInfo 6-arg form here is the RN 0.83 shape (the older 7-arg form
 * carried a `hasConstants` flag, removed in 0.74). The device build is the first
 * real check.
 */
class KitbagCorePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == KitbagCommandsModule.NAME) {
      KitbagCommandsModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        KitbagCommandsModule.NAME to
          ReactModuleInfo(
            KitbagCommandsModule.NAME, // name
            KitbagCommandsModule::class.java.name, // className
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true, // isTurboModule
          ),
      )
    }
}
