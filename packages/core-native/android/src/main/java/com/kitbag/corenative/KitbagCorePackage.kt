package com.kitbag.corenative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registration seam for @kitbag/core-native's native surface (SPEC §13.1: the
 * JSI/TurboModule surface is owned here). Two things attach to the RN runtime
 * through this package, both kept on the single kb_engine* the HostObject owns
 * (SPEC §4.5):
 *   1. The KitbagCommands TurboModule (getModule below), routing each command to
 *      kitbag::command* via JNI (KitbagJni.cpp).
 *   2. The JSI HostObject install (kitbag::kitbagInstall) — triggered from the
 *      TurboModule's constructor (KitbagCommandsModule.init), because that is the
 *      first point a live JSI runtime handle is available. The 60fps read path
 *      (§13.3) is then completed on the UI runtime from JS (bootstrapRuntime.ts).
 *
 * The module name comes from `NativeKitbagCommandsSpec.NAME`, the codegen-owned
 * constant (§13.7: one owner). It is never retyped here.
 *
 * NOT VERIFIED on device. This compiles against the RN 0.83 `BaseReactPackage` /
 * `ReactModuleInfo` (6-arg) API; the runtime seam is the #33 gate.
 */
class KitbagCorePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == NativeKitbagCommandsSpec.NAME) {
      KitbagCommandsModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        NativeKitbagCommandsSpec.NAME to
          ReactModuleInfo(
            NativeKitbagCommandsSpec.NAME, // name
            KitbagCommandsModule::class.java.name, // className
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true, // isTurboModule
          ),
      )
    }
}
