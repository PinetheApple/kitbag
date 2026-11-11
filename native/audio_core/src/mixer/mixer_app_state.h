#ifndef KITBAG_MIXER_MIXER_APP_STATE_H
#define KITBAG_MIXER_MIXER_APP_STATE_H

#include <cstdint>

namespace kitbag {

struct MixerHead {
  int64_t stream;
  int64_t transport;
  bool jump_pending;
};

struct MixerEngageState {
  bool engaged;
  bool vendor_default;
};

struct MixerPrepared {
  MixerEngageState before;
  uint32_t created = 0;
  bool prime = false;
};

}  // namespace kitbag

#endif  // KITBAG_MIXER_MIXER_APP_STATE_H
