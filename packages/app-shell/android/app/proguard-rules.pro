# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# --- Kitbag native bindings (#49) -------------------------------------------
# R8 stripping or renaming any of these makes native go silent with no error —
# the exact failure mode this repo keeps documenting (headless gates never
# compile the Kotlin/JNI chain). Each rule names what breaks without it.

# Package registration. RN reaches KitbagCorePackage through the generated
# PackageList by direct reference, but ReactModuleInfo hands the module's
# class name to the framework as a STRING that is resolved reflectively;
# without this keep the module can be renamed out from under that lookup.
-keep class com.kitbag.corenative.KitbagCorePackage { *; }

# The TurboModule and its codegen'd spec. The module's `external fun` methods
# are bound by JNI through exported symbol names derived from the fully
# qualified class name (Java_com_kitbag_corenative_KitbagCommandsModule_<method>);
# renaming the class or its members severs every command AND the HostObject
# install, which happens in the module constructor (nativeInstall).
-keep class com.kitbag.corenative.KitbagCommandsModule { *; }
-keep class com.kitbag.corenative.NativeKitbagCommandsSpec { *; }
