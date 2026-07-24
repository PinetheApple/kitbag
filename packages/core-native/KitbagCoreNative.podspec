# iOS packaging for @kitbag/core-native's JSI glue (P2-A4, #31).
#
# SKELETON (#31). This box is not macOS, so `pod install` / xcodebuild has run
# NOWHERE against this file — the on-device iOS link is #33. What is committed is
# the shape: compile the same JSI glue as Android, resolve the C ABI header from
# native/audio_core/include, and build kitbag_core from its EXISTING CMakeLists
# rather than restating its source list here (SPEC §13.8 "the C++ does not move";
# §13.7 one definition of the file list, owned by that CMakeLists).
#
# DEFERRED to #33 (needs macOS): confirming the static-vs-shared choice for
# kitbag_core on iOS (its CMakeLists builds SHARED), arch/slice handling, and the
# exact RN pod dependency names for 0.83. Do not read this as verified.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

repo_root = File.expand_path("../..", __dir__)
core_dir  = File.join(repo_root, "native", "audio_core")

Pod::Spec.new do |s|
  s.name         = "KitbagCoreNative"
  s.version      = package["version"]
  s.summary      = "Kitbag realtime core JSI bindings (SPEC §13.1/§13.2)."
  s.homepage     = "https://github.com/PinetheApple/music_app"
  s.license      = "MIT"
  s.authors      = "Kitbag"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/PinetheApple/music_app.git" }

  # Only the JSI glue is compiled directly by the pod. kitbag_core is built from
  # its own CMakeLists by the script phase below, so its .cpp files are NOT
  # listed here (that list has one owner — the CMakeLists).
  s.source_files = "cpp/*.{h,cpp}"

  s.pod_target_xcconfig = {
    # kitbag_api.h is included, never copied (§13.7). C++20 for the glue and the
    # vendored cycfi/q concepts kitbag_core uses.
    "HEADER_SEARCH_PATHS" => "\"#{core_dir}/include\"",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    # kitbag_core's static archive, produced by the script phase into the pod's
    # build dir.
    "OTHER_LDFLAGS" => "-lkitbag_core"
  }

  # SKELETON (#33): configure + build the existing CMake for the iOS SDK. Kept as
  # a script phase (not a source_files glob) so the file list stays owned by
  # native/audio_core/CMakeLists.txt. The concrete SDK/arch flags are #33's to
  # settle on macOS.
  s.script_phase = {
    :name => "Build kitbag_core (SKELETON #31)",
    :script => <<~SH,
      echo "SKELETON (#31): kitbag_core iOS build is wired but unverified — see #33." >&2
      # cmake -S "#{core_dir}" -B "${PODS_TARGET_SRCROOT}/build-ios" ...
      # cmake --build "${PODS_TARGET_SRCROOT}/build-ios"
    SH
    :execution_position => :before_compile
  }

  # Pulls React-jsi/React-Core/ReactCommon/fbjni per the installed RN version so
  # the glue sees <jsi/jsi.h>. Exact for RN's New Architecture pods (§13.8).
  install_modules_dependencies(s)
end
