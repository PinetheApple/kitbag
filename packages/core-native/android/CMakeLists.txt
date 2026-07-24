# Android JSI glue for @kitbag/core-native (SPEC §13.8: "The C++ does not move").
#
# This is consumed by the app module's externalNativeBuild (see
# packages/app-shell/android/app/build.gradle). It does NOT relocate or copy the
# C++ core: it add_subdirectory()s the existing native/audio_core tree in place,
# building the same kitbag_core target CI already builds headlessly, and links
# the JSI glue against it plus React Native's prefab-published jsi/reactnative.

cmake_minimum_required(VERSION 3.22)
project(kitbag_jsi LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Repo root relative to THIS file (packages/core-native/android/). Everything
# below is anchored here so no absolute path leaks into the build.
get_filename_component(KITBAG_REPO_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../.." ABSOLUTE)
set(KITBAG_CORE_DIR "${KITBAG_REPO_ROOT}/native/audio_core")
set(KITBAG_GLUE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")

# Build kitbag_core from its own CMakeLists, in place. The build outputs land in
# this module's binary dir; the sources are never touched (§13.8).
add_subdirectory("${KITBAG_CORE_DIR}" "${CMAKE_CURRENT_BINARY_DIR}/audio_core")

add_library(kitbag_jsi SHARED
  "${KITBAG_GLUE_DIR}/KitbagHostObject.cpp"
  "${KITBAG_GLUE_DIR}/KitbagEngine.cpp"
  "${KITBAG_GLUE_DIR}/KitbagCommands.cpp"
  # Android-only JNI bridge (staged for #33): exposes kitbagInstall + command*
  # to the Kotlin TurboModule. The file is wholly #ifdef __ANDROID__, so it is a
  # no-op TU anywhere else.
  "${KITBAG_GLUE_DIR}/KitbagJni.cpp")

target_include_directories(kitbag_jsi PRIVATE
  "${KITBAG_GLUE_DIR}"
  # kitbag_api.h is the ONE definition of the C ABI (§13.7): included here, never
  # copied. This is the same header native/audio_core exports as PUBLIC.
  "${KITBAG_CORE_DIR}/include")

# RN 0.83 publishes jsi and the merged `reactnative` artifact via prefab, and
# fbjni via its own prefab package. The app module must set
# `buildFeatures { prefab true }` for these to resolve — without a Gradle build
# providing them there is no jsi/jsi.h on the include path, which is why the
# glue has compiled nowhere until now.
find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

target_link_libraries(kitbag_jsi
  kitbag_core
  ReactAndroid::jsi
  ReactAndroid::reactnative
  fbjni::fbjni
  log)
