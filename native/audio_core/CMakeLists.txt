cmake_minimum_required(VERSION 3.22)
project(kitbag_core LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
# C++20: the vendored cycfi/q pitch core uses concepts.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_library(kitbag_core SHARED
  src/api.cpp
  src/decoder.cpp
  src/engine.cpp
  src/metronome.cpp
  src/miniaudio_impl.c
  src/pitch_analyzer.cpp
  src/tuner.cpp
)

target_include_directories(kitbag_core
  PUBLIC include
  PRIVATE src third_party
)
# SYSTEM: keep -Wall -Wextra for our code without patching vendored headers.
target_include_directories(kitbag_core SYSTEM PRIVATE third_party/cycfi_q/include)

target_compile_options(kitbag_core PRIVATE -Wall -Wextra)
set_target_properties(kitbag_core PROPERTIES C_VISIBILITY_PRESET hidden CXX_VISIBILITY_PRESET hidden)

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

  add_executable(metronome_verify tools/metronome_verify.cpp src/metronome.cpp)
  target_include_directories(metronome_verify PRIVATE src)
  target_link_libraries(metronome_verify PRIVATE m)

  add_executable(tuner_verify tools/tuner_verify.cpp src/pitch_analyzer.cpp)
  target_include_directories(tuner_verify PRIVATE src)
  target_include_directories(tuner_verify SYSTEM PRIVATE third_party/cycfi_q/include)
  target_link_libraries(tuner_verify PRIVATE m)
endif()
