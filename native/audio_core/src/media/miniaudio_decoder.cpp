#include "media/miniaudio_decoder.h"

#include "miniaudio.h"

namespace kitbag {

bool OpenDecoderF32(const char* path, ma_decoder* out) {
  const ma_decoder_config config = ma_decoder_config_init(ma_format_f32, 0, 0);
  return ma_decoder_init_file(path, &config, out) == MA_SUCCESS;
}

}  // namespace kitbag
