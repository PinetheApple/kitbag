#ifndef KITBAG_MIXER_MIXER_COMMAND_H
#define KITBAG_MIXER_MIXER_COMMAND_H

#include <cstdint>

namespace kitbag {

enum class MixerCommandType : uint8_t {
  kSetGain,
  kSetMute,
  kSetSolo,
  kPlay,
  kStop,
  kPause,
  kSetMasterGain,
  kSetRate,
  kSetTrackPitch,
};

struct MixerCommand {
  MixerCommandType type;
  int32_t track = 0;
  float fvalue = 0.0f;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_COMMAND_H
