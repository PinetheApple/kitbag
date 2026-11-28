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
      NativeKitbagToolsSpec.NAME -> KitbagToolsModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      listOf(
        NativeKitbagCommandsSpec.NAME to KitbagCommandsModule::class.java,
        NativeKitbagLibrarySpec.NAME to KitbagLibraryModule::class.java,
        NativeKitbagStemDeckSpec.NAME to KitbagStemDeckModule::class.java,
        NativeKitbagMediaSessionsSpec.NAME to KitbagMediaSessionsModule::class.java,
        NativeKitbagToolsSpec.NAME to KitbagToolsModule::class.java,
      ).associate { (name, type) -> name to turboModule(name, type) }
    }

  private fun turboModule(name: String, type: Class<out NativeModule>) =
    ReactModuleInfo(name, type.name, false, false, false, true)
}
