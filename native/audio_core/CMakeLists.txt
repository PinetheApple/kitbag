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
  src/api/api.cpp
  src/api/api_analysis.cpp
  src/api/api_media.cpp
  src/api/api_metronome.cpp
  src/analysis/beat_tracker.cpp
  src/analysis/downbeat.cpp
  src/analysis/song_analysis.cpp
  src/media/audio_source.cpp
  src/media/decoder.cpp
  src/media/file_audio_reader.cpp
  src/media/miniaudio_decoder.cpp
  src/media/resampling_source_reader.cpp
  src/engine.cpp
  src/dsp/fft.cpp
  src/metronome/metronome.cpp
  src/metronome/metronome_grid.cpp
  src/metronome/metronome_render.cpp
  src/media/miniaudio_impl.c
  src/mixer/mixer.cpp
  src/mixer/mixer_render.cpp
  src/player/player.cpp
  src/player/player_render.cpp
  src/tuner/note_lock.cpp
  src/tuner/pitch_analyzer.cpp
  src/tuner/tuner.cpp
  src/analysis/waveform_peaks.cpp
)

target_include_directories(kitbag_core
  PUBLIC include
  PRIVATE src third_party
)
# SYSTEM: keep -Wall -Wextra for our code without patching vendored headers.
target_include_directories(kitbag_core SYSTEM PRIVATE third_party/cycfi_q/include)

# -Werror=switch and nothing else: the exhaustive switch over CommandType
# (metronome.cpp) is load-bearing — a new command must not compile to a silent drop.
target_compile_options(kitbag_core PRIVATE -Wall -Wextra -Werror=switch)
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

# Vendored QM-DSP downbeat/beat tracker (GPL-2.0-or-later, third_party/qm-dsp).
# Built as its own static lib so its upstream sources never inherit our
# -Wall/-Werror. Linked into kitbag_core below for downbeat labelling (D2 #13).
add_library(qm_dsp STATIC
  third_party/qm-dsp/dsp/tempotracking/DownBeat.cpp
  third_party/qm-dsp/dsp/tempotracking/TempoTrackV2.cpp
  third_party/qm-dsp/dsp/rateconversion/Decimator.cpp
  third_party/qm-dsp/dsp/transforms/FFT.cpp
  third_party/qm-dsp/maths/MathUtilities.cpp
  third_party/qm-dsp/maths/KLDivergence.cpp
  third_party/qm-dsp/ext/kissfft/kiss_fft.c
  third_party/qm-dsp/ext/kissfft/tools/kiss_fftr.c
)
# Root resolves "dsp/..."/"maths/..."; kissfft dirs resolve its local includes.
# kiss_fft_scalar=double: FFT.cpp casts double buffers into kiss_fft_cpx; the
# default float scalar mismatches the struct layout and corrupts FFT data (not
# mere precision loss) — matches upstream build/general/Makefile.inc.
target_include_directories(qm_dsp SYSTEM PUBLIC
  third_party/qm-dsp
  third_party/qm-dsp/ext/kissfft
  third_party/qm-dsp/ext/kissfft/tools)
target_compile_definitions(qm_dsp PUBLIC kiss_fft_scalar=double)

# song_analysis.cpp's downbeat labelling calls DownBeat; kissfft's include roots
# come transitively from qm_dsp's PUBLIC dirs.
target_link_libraries(kitbag_core PRIVATE qm_dsp)

option(KITBAG_BUILD_TOOLS "Build native test tools" OFF)
if(KITBAG_BUILD_TOOLS)
  # Compiles kb_engine_render into the library and reveals its header
  # declaration; PUBLIC so a tool that links kitbag_core (abi/stream_verify)
  # sees it too. Absent from a production build, so no PCM crosses the shipped
  # ABI (SPEC.md §4.1) — the render pull is a verify-only symbol by construction.
  target_compile_definitions(kitbag_core PUBLIC KITBAG_BUILD_TOOLS)

  add_executable(metronome_verify
    tools/metronome/metronome_verify.cpp
    tools/metronome/metronome_test_basic.cpp
    tools/metronome/metronome_test_grid.cpp
    tools/metronome/metronome_test_latency.cpp
    tools/metronome/metronome_test_startat.cpp
    tools/metronome/metronome_test_anchor.cpp
    tools/rt/rt_publisher_verify.cpp
    src/metronome/metronome.cpp
    src/metronome/metronome_grid.cpp
    src/metronome/metronome_render.cpp)
  target_include_directories(metronome_verify PRIVATE src tools tools/metronome tools/rt)
  # metronome.cpp is compiled again here, outside kitbag_core's options.
  target_compile_options(metronome_verify PRIVATE -Werror=switch)
  target_link_libraries(metronome_verify PRIVATE m)

  # Links the shared library rather than the sources: the point is to prove the
  # exported C ABI, not the C++ behind it. tools/media supplies the WAV writer
  # the mixer load test writes its fixture with.
  add_executable(abi_verify tools/abi_verify.cpp)
  target_include_directories(abi_verify PRIVATE tools/media)
  target_link_libraries(abi_verify PRIVATE kitbag_core)

  # A6 (#11): streams a real WAV end to end through the C ABI (kb_player_load ->
  # kb_engine_render), so playback crosses the interface the app will, not the
  # C++ behind it. Links the shared library, like abi_verify; writes its fixtures.
  add_executable(stream_verify tools/media/stream_verify.cpp)
  target_include_directories(stream_verify PRIVATE tools/media)
  target_link_libraries(stream_verify PRIVATE kitbag_core)

  # Links the sources: TrackBeats and SidecarPath are internal, not exported.
  add_executable(beat_tracker_verify tools/analysis/beat_tracker_verify.cpp
    src/analysis/beat_tracker.cpp src/dsp/fft.cpp)
  target_include_directories(beat_tracker_verify PRIVATE src include)
  target_link_libraries(beat_tracker_verify PRIVATE m)

  # Links the sources: Mixer is internal, not exported through the C ABI. Each
  # track streams through an AudioSource, so the mixer tool links it and Threads.
  find_package(Threads REQUIRED)
  # A4 loads tracks from real files (kb_mixer_load_track), so the tool writes a
  # temp WAV and links the miniaudio-backed file adapter. Resampling on load also
  # pulls miniaudio in (ma_data_converter).
  add_executable(mixer_verify
    tools/mixer/mixer_verify.cpp
    tools/mixer/mixer_test_transport.cpp
    tools/mixer/mixer_test_mix.cpp
    tools/mixer/mixer_test_source.cpp
    tools/mixer/mixer_test_resample.cpp
    tools/mixer/mixer_test_publish.cpp
    src/mixer/mixer.cpp
    src/mixer/mixer_render.cpp
    src/media/audio_source.cpp
    src/media/file_audio_reader.cpp
    src/media/miniaudio_decoder.cpp
    src/media/resampling_source_reader.cpp
    src/media/miniaudio_impl.c
  )
  target_include_directories(mixer_verify PRIVATE src tools tools/mixer tools/media third_party)
  # mixer_render.cpp's exhaustive CommandType switch is load-bearing here too.
  target_compile_options(mixer_verify PRIVATE -Werror=switch)
  target_link_libraries(mixer_verify PRIVATE Threads::Threads m ${CMAKE_DL_LIBS})

  # Links the sources: Player is internal, not exported through the C ABI. It
  # streams a single source through an AudioSource over a real file path, so the
  # tool writes a temp WAV and links the file adapter and Threads, like the mixer.
  add_executable(player_verify
    tools/player/player_verify.cpp
    src/player/player.cpp
    src/player/player_render.cpp
    src/media/audio_source.cpp
    src/media/file_audio_reader.cpp
    src/media/miniaudio_decoder.cpp
    src/media/resampling_source_reader.cpp
    src/media/miniaudio_impl.c
  )
  target_include_directories(player_verify PRIVATE src tools tools/media third_party)
  # player_render.cpp's exhaustive CommandType switch is load-bearing here too.
  target_compile_options(player_verify PRIVATE -Werror=switch)
  target_link_libraries(player_verify PRIVATE Threads::Threads m ${CMAKE_DL_LIBS})

  # Threaded seek-race verify (#25): a live Seek during an active render loop must
  # never emit a stale/underflowed block. Links the mixer and player sources plus
  # the file adapter (the player streams a real WAV), and Threads for the loop.
  add_executable(seek_race_verify
    tools/seek_race_verify.cpp
    src/mixer/mixer.cpp
    src/mixer/mixer_render.cpp
    src/player/player.cpp
    src/player/player_render.cpp
    src/media/audio_source.cpp
    src/media/file_audio_reader.cpp
    src/media/miniaudio_decoder.cpp
    src/media/resampling_source_reader.cpp
    src/media/miniaudio_impl.c
  )
  target_include_directories(seek_race_verify PRIVATE src tools tools/media third_party)
  target_compile_options(seek_race_verify PRIVATE -Werror=switch)
  target_link_libraries(seek_race_verify PRIVATE Threads::Threads m ${CMAKE_DL_LIBS})

  # Drives the in-memory adapter. That this target links no miniaudio and still
  # passes is what proves the seam: the module depends on SourceReader, not on
  # a decoder. The file adapter gets its own tool below — the seam has two
  # sides and both are compiled into a test.
  add_executable(audio_source_verify
    tools/media/audio_source_verify.cpp
    tools/media/audio_source_test_stream.cpp
    tools/media/audio_source_test_edge.cpp
    tools/rt/spsc_bulk_ring_test.cpp
    src/media/audio_source.cpp
  )
  target_include_directories(audio_source_verify
    PRIVATE src tools tools/media tools/rt)
  target_link_libraries(audio_source_verify PRIVATE Threads::Threads m)

  # The other side: FileAudioReader over a WAV the tool writes at run time, so
  # no binary fixture is committed.
  add_executable(file_audio_reader_verify
    tools/media/file_audio_reader_verify.cpp
    src/media/file_audio_reader.cpp
  src/media/miniaudio_decoder.cpp
    src/media/miniaudio_impl.c
  )
  target_include_directories(file_audio_reader_verify
    PRIVATE src tools tools/media third_party)
  target_link_libraries(file_audio_reader_verify PRIVATE Threads::Threads m ${CMAKE_DL_LIBS})

  # The offline decode path behind kb_analyze_song, over the same run-time WAV.
  add_executable(decoder_verify
    tools/media/decoder_verify.cpp
    src/media/decoder.cpp
    src/media/miniaudio_decoder.cpp
    src/media/miniaudio_impl.c
  )
  target_include_directories(decoder_verify
    PRIVATE src tools tools/media third_party)
  target_link_libraries(decoder_verify PRIVATE Threads::Threads m ${CMAKE_DL_LIBS})

  # The composition Decoder -> DownmixToMono -> BeatTracker -> sidecar, plus the
  # non-finite and narrowing guards. Links sources: AnalyzeDecodedPcm and
  # NarrowFrames are internal and the NaN path cannot be reached through a WAV.
  add_executable(analyze_verify
    tools/analysis/analyze_verify.cpp
    tools/analysis/analyze_test_downbeat.cpp
    src/api/api_analysis.cpp
    src/analysis/song_analysis.cpp
    src/analysis/downbeat.cpp
    src/analysis/waveform_peaks.cpp
    src/analysis/beat_tracker.cpp
    src/dsp/fft.cpp
    src/media/decoder.cpp
    src/media/miniaudio_decoder.cpp
    src/media/miniaudio_impl.c
  )
  target_include_directories(analyze_verify
    PRIVATE src include tools tools/media third_party)
  target_link_libraries(analyze_verify PRIVATE qm_dsp Threads::Threads m ${CMAKE_DL_LIBS})

  add_executable(note_lock_verify tools/tuner/note_lock_verify.cpp
    src/tuner/note_lock.cpp)
  target_include_directories(note_lock_verify PRIVATE src)
  target_link_libraries(note_lock_verify PRIVATE m)

  add_executable(tuner_verify tools/tuner/tuner_verify.cpp
    src/tuner/pitch_analyzer.cpp src/tuner/note_lock.cpp)
  target_include_directories(tuner_verify PRIVATE src)
  target_include_directories(tuner_verify SYSTEM PRIVATE third_party/cycfi_q/include)
  target_link_libraries(tuner_verify PRIVATE m)
endif()
