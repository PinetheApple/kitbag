package com.kitbag.corenative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class KitbagCorePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    when (name) {
      NativeKitbagCommandsSpec.NAME -> KitbagCommandsModule(reactContext)
      NativeKitbagLibrarySpec.NAME -> KitbagLibraryModule(reactContext)
      NativeKitbagStemDeckSpec.NAME -> KitbagStemDeckModule(reactContext)
      NativeKitbagMediaSessionsSpec.NAME -> KitbagMediaSessionsModule(reactContext)
      else -> null
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
        NativeKitbagLibrarySpec.NAME to
          ReactModuleInfo(
            NativeKitbagLibrarySpec.NAME, // name
            KitbagLibraryModule::class.java.name, // className
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true, // isTurboModule
          ),
        NativeKitbagStemDeckSpec.NAME to
          ReactModuleInfo(
            NativeKitbagStemDeckSpec.NAME,
            KitbagStemDeckModule::class.java.name,
            false,
            false,
            false,
            true,
          ),
        NativeKitbagMediaSessionsSpec.NAME to
          ReactModuleInfo(
            NativeKitbagMediaSessionsSpec.NAME,
            KitbagMediaSessionsModule::class.java.name,
            false,
            false,
            false,
            true,
          ),
      )
    }
}
