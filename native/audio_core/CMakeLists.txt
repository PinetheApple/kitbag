cmake_minimum_required(VERSION 3.22)
project(kitbag_core LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_library(kitbag_core SHARED
  src/api.cpp
  src/engine.cpp
  src/miniaudio_impl.c
)

target_include_directories(kitbag_core
  PUBLIC include
  PRIVATE src third_party
)

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
endif()
