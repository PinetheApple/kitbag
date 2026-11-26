#ifndef KITBAG_METRONOME_METRONOME_COMMAND_H
#define KITBAG_METRONOME_METRONOME_COMMAND_H

#include <cstdint>

namespace kitbag {

enum class MetronomeCommandType : uint8_t {
  kStart,
  kStartAt,
  kCountInAt,
  kStop,
  kPause,
  kAnchorExternal,
  kSetTempo,
  kSetBeats,
  kSetSubdivision,
  kSetSubdivisionAccents,
  kSetGridClick,
  kSetAccent,
  kSetPoly,
  kSetPolyAccent,
  kSetPolyAgainst,
  kSetSounds,
  kSetCountIn,
  kPreviewSound,
  kSetRamp,
  kSetBarMute,
  kSetVolume,
  kSetLatencyOffset,
  kSetFollowMixer,
};

enum class ExternalAnchor : int32_t { kConstantTempo, kGrid };

struct MetronomeCommand {
  MetronomeCommandType type;
  double value = 0.0;
  double value_b = 0.0;
  double value_c = 0.0;
  double value_d = 0.0;
  int32_t int_a = 0;
  int32_t int_b = 0;
  int32_t int_c = 0;
  uint64_t frame = 0;
  uint64_t word = 0;
  uint32_t epoch = 0;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_COMMAND_H
