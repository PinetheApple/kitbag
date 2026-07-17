#include "decoder.h"

#include <cmath>
#include <cstring>

#include "miniaudio.h"

namespace kitbag {

Decoder::Decoder() {}

Decoder::~Decoder() { Close(); }

bool Decoder::Open(const char* path) {
  Close();

  auto* dec = new ma_decoder();
  const ma_result result = ma_decoder_init_file(path, nullptr, dec);
  if (result != MA_SUCCESS) {
    delete dec;
    return false;
  }

  decoder_ = dec;
  info_.sample_rate = dec->outputSampleRate;
  info_.channels = dec->outputChannels;
  ma_uint64 total_frames = 0;
  ma_decoder_get_length_in_pcm_frames(dec, &total_frames);
  info_.total_frames = total_frames;
  info_.duration_seconds =
      static_cast<double>(info_.total_frames) / info_.sample_rate;

  is_open_.store(true);
  return true;
}

std::vector<float> Decoder::DecodeAll(uint64_t* out_frames) {
  if (!is_open_.load() || decoder_ == nullptr) {
    *out_frames = 0;
    return {};
  }

  const auto total = info_.total_frames * info_.channels;
  std::vector<float> buffer(total);

  ma_decoder_seek_to_pcm_frame(decoder_, 0);
  ma_uint64 frames_read = 0;
  ma_decoder_read_pcm_frames(decoder_, buffer.data(), info_.total_frames,
                             &frames_read);

  *out_frames = frames_read;
  if (frames_read < info_.total_frames) {
    buffer.resize(frames_read * info_.channels);
  }
  return buffer;
}

void Decoder::Close() {
  is_open_.store(false);
  if (decoder_ != nullptr) {
    ma_decoder_uninit(decoder_);
    delete decoder_;
    decoder_ = nullptr;
  }
  info_ = DecoderInfo{};
}

}  // namespace kitbag
