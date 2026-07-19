cmake_minimum_required(VERSION 3.22)
project(kitbag_core LANGUAGES C CXX)

# The render loop is split across translation units, so the per-sample helpers
# it calls only inline under LTO. Default to Release for the same reason.
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

include(CheckIPOSupported)
check_ipo_supported(RESULT KITBAG_IPO_SUPPORTED OUTPUT KITBAG_IPO_ERROR)
if(NOT KITBAG_IPO_SUPPORTED)
  message(STATUS "kitbag: LTO unavailable, render helpers stay out of line: ${KITBAG_IPO_ERROR}")
endif()

# clang-tidy needs this; scripts/lint.sh skips its entire static-analysis half
# without it, and used to do so while still exiting 0.
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(CMAKE_C_STANDARD 11)
# C++20: the vendored cycfi/q pitch core uses concepts.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_library(kitbag_core SHARED
  src/api.cpp
  src/api_analysis.cpp
  src/api_media.cpp
  src/api_metronome.cpp
  src/beat_tracker.cpp
  src/decoder.cpp
  src/engine.cpp
  src/fft.cpp
  src/metronome.cpp
  src/metronome_grid.cpp
  src/metronome_render.cpp
  src/miniaudio_impl.c
  src/mixer.cpp
  src/note_lock.cpp
  src/pitch_analyzer.cpp
  src/tuner.cpp
  src/waveform_peaks.cpp
)

target_include_directories(kitbag_core
  PUBLIC include
  PRIVATE src third_party
)
# SYSTEM: keep -Wall -Wextra for our code without patching vendored headers.
target_include_directories(kitbag_core SYSTEM PRIVATE third_party/cycfi_q/include)

target_compile_options(kitbag_core PRIVATE -Wall -Wextra)
set_target_properties(kitbag_core PROPERTIES C_VISIBILITY_PRESET hidden CXX_VISIBILITY_PRESET hidden)
set_target_properties(kitbag_core PROPERTIES
  INTERPROCEDURAL_OPTIMIZATION_RELEASE ${KITBAG_IPO_SUPPORTED}
  INTERPROCEDURAL_OPTIMIZATION_RELWITHDEBINFO ${KITBAG_IPO_SUPPORTED})

if(ANDROID)
  target_link_libraries(kitbag_core PRIVATE log OpenSLES)
else()
  find_package(Threads REQUIRED)
  target_link_libraries(kitbag_core PRIVATE Threads::Threads ${CMAKE_DL_LIBS} m)
endif()

option(KITBAG_BUILD_TOOLS "Build native test tools" OFF)
if(KITBAG_BUILD_TOOLS)
  add_executable(tone_test tools/tone_test.c)
  target_link_libraries(tone_test PRIVATE kitbag_core)

  add_executable(metronome_verify
    tools/metronome_verify.cpp
    tools/metronome_test_basic.cpp
    tools/metronome_test_grid.cpp
    tools/metronome_test_latency.cpp
    tools/metronome_test_publisher.cpp
    tools/metronome_test_startat.cpp
    src/metronome.cpp
    src/metronome_grid.cpp
    src/metronome_render.cpp)
  target_include_directories(metronome_verify PRIVATE src)
  target_link_libraries(metronome_verify PRIVATE m)

  # Links the shared library rather than the sources: the point is to prove the
  # exported C ABI, not the C++ behind it.
  add_executable(abi_verify tools/abi_verify.cpp)
  target_link_libraries(abi_verify PRIVATE kitbag_core)

  # Links the sources: TrackBeats and SidecarPath are internal, not exported.
  add_executable(beat_tracker_verify tools/beat_tracker_verify.cpp
    src/beat_tracker.cpp src/fft.cpp)
  target_include_directories(beat_tracker_verify PRIVATE src include)
  target_link_libraries(beat_tracker_verify PRIVATE m)

  add_executable(note_lock_verify tools/note_lock_verify.cpp src/note_lock.cpp)
  target_include_directories(note_lock_verify PRIVATE src)
  target_link_libraries(note_lock_verify PRIVATE m)

  add_executable(tuner_verify tools/tuner_verify.cpp src/pitch_analyzer.cpp src/note_lock.cpp)
  target_include_directories(tuner_verify PRIVATE src)
  target_include_directories(tuner_verify SYSTEM PRIVATE third_party/cycfi_q/include)
  target_link_libraries(tuner_verify PRIVATE m)
endif()
