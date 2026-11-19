#include "mixdown/wav_writer.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <limits>
#include <utility>

#include "media/part_file.h"
#include "media/riff_bytes.h"

namespace kitbag {
namespace {

using riff::kRiffPreambleBytes;
using riff::PutU16;

constexpr uint16_t kPcmFormat = 1;
constexpr float kS16Max = std::numeric_limits<int16_t>::max();

int16_t ToS16(float sample) {
  const float clamped = std::clamp(sample, -1.0f, 1.0f);
  return static_cast<int16_t>(std::lround(clamped * kS16Max));
}

}  // namespace

uint64_t WavWriter::MaxFrames() {
  const uint64_t room = std::numeric_limits<uint32_t>::max() -
                        (kHeaderBytes - kRiffPreambleBytes);
  return room / kBytesPerFrame;
}

WavWriter::~WavWriter() {
  Abort();
}

bool WavWriter::Open(
    const std::string& path,
    uint32_t sample_rate,
    uint32_t max_block_frames
) {
  Abort();
  path_ = path;
  part_ = path + kPartSuffix;
  sample_rate_ = sample_rate;
  frames_ = 0;
  bytes_.reserve(static_cast<size_t>(max_block_frames) * kBytesPerFrame);
  file_ = std::fopen(part_.c_str(), "wb");
  if (file_ != nullptr && WriteHeader(0)) return true;
  Abort();
  return false;
}

bool WavWriter::WriteHeader(uint64_t frames) {
  const auto data = static_cast<uint32_t>(frames * kBytesPerFrame);
  const std::vector<uint8_t> header = riff::WavHeader(
      {kPcmFormat,
       static_cast<uint16_t>(kChannels),
       sample_rate_,
       static_cast<uint16_t>(kBitsPerSample)},
      data
  );
  return std::fseek(file_, 0, SEEK_SET) == 0 &&
         std::fwrite(header.data(), 1, header.size(), file_) == header.size();
}

bool WavWriter::Write(const float* interleaved, uint32_t frames) {
  if (file_ == nullptr || frames_ + frames > MaxFrames()) return false;
  bytes_.clear();
  for (size_t i = 0; i < static_cast<size_t>(frames) * kChannels; ++i) {
    PutU16(&bytes_, static_cast<uint16_t>(ToS16(interleaved[i])));
  }
  if (std::fwrite(bytes_.data(), 1, bytes_.size(), file_) != bytes_.size()) {
    return false;
  }
  frames_ += frames;
  return true;
}

bool WavWriter::Finish() {
  if (file_ == nullptr) return false;
  const bool written = WriteHeader(frames_);
  const bool closed = std::fclose(std::exchange(file_, nullptr)) == 0;
  if (!written || !closed || CommitPartFile(path_) != FileWrite::kOk) {
    Abort();
    return false;
  }
  part_.clear();
  return true;
}

void WavWriter::Abort() {
  if (file_ != nullptr) std::fclose(std::exchange(file_, nullptr));
  if (!part_.empty()) std::remove(part_.c_str());
  part_.clear();
}

}  // namespace kitbag
