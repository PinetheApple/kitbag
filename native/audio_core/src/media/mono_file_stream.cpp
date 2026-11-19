#include "media/mono_file_stream.h"

#include <algorithm>

namespace kitbag {

bool MonoFileStream::Open(const char* path, uint32_t rate) {
  if (!file_.Open(path) || file_.channels() == 0) return false;
  source_ = &file_;
  if (file_.sample_rate() != rate) {
    resampler_ = std::make_unique<ResamplingSourceReader>(&file_, rate);
    if (!resampler_->ok()) return false;
    source_ = resampler_.get();
  }
  interleaved_.assign(
      static_cast<size_t>(kChunkFrames) * file_.channels(),
      0.0F
  );
  ended_ = false;
  return true;
}

uint32_t MonoFileStream::Read(float* mono, uint32_t frames) {
  if (source_ == nullptr || ended_) return 0;
  const ReadResult result =
      source_->ReadFrames(interleaved_.data(), std::min(frames, kChunkFrames));
  ended_ = result.status != ReadStatus::kOk;
  const uint32_t channels = source_->channels();
  const auto got = static_cast<uint32_t>(result.frames);
  for (uint32_t frame = 0; frame < got; ++frame) {
    float sum = 0.0F;
    for (uint32_t channel = 0; channel < channels; ++channel) {
      sum += interleaved_[static_cast<size_t>(frame) * channels + channel];
    }
    mono[frame] = sum / static_cast<float>(channels);
  }
  return got;
}

}  // namespace kitbag
