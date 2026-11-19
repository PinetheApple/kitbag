#include "media/mono_file_stream.h"

#include <algorithm>

#include "media/downmix.h"

namespace kitbag {

uint32_t MonoFileStream::CountingReader::channels() const {
  return inner->channels();
}

uint32_t MonoFileStream::CountingReader::sample_rate() const {
  return inner->sample_rate();
}

uint64_t MonoFileStream::CountingReader::total_frames() const {
  return inner->total_frames();
}

ReadResult
MonoFileStream::CountingReader::ReadFrames(float* dst, uint64_t frames) {
  const ReadResult result = inner->ReadFrames(dst, frames);
  this->frames += result.frames;
  blocked = blocked || result.status == ReadStatus::kWouldBlock;
  return result;
}

bool MonoFileStream::CountingReader::SeekToFrame(uint64_t frame) {
  return inner->SeekToFrame(frame);
}

bool MonoFileStream::Open(const char* path, uint32_t rate) {
  return file_.Open(path) && Open(&file_, rate);
}

bool MonoFileStream::Open(SourceReader* source, uint32_t rate) {
  if (source->channels() == 0) return false;
  counted_ = CountingReader{};
  counted_.inner = source;
  source_ = &counted_;
  if (source->sample_rate() != rate) {
    resampler_ = std::make_unique<ResamplingSourceReader>(&counted_, rate);
    if (!resampler_->ok()) return false;
    source_ = resampler_.get();
  }
  interleaved_.assign(
      static_cast<size_t>(kChunkFrames) * source->channels(),
      0.0F
  );
  ended_ = false;
  failed_ = false;
  return true;
}

void MonoFileStream::Finish() {
  ended_ = true;
  const uint64_t stated = counted_.total_frames();
  failed_ = counted_.blocked || (stated > 0 && counted_.frames < stated);
}

uint32_t MonoFileStream::Read(float* mono, uint32_t frames) {
  if (source_ == nullptr || ended_) return 0;
  const ReadResult result =
      source_->ReadFrames(interleaved_.data(), std::min(frames, kChunkFrames));
  if (result.status != ReadStatus::kOk) Finish();
  const auto got = static_cast<uint32_t>(result.frames);
  DownmixToMono(interleaved_.data(), got, source_->channels(), mono);
  return got;
}

}  // namespace kitbag
