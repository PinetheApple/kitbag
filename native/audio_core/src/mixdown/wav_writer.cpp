#include "mixdown/wav_writer.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <limits>
#include <system_error>
#include <utility>

namespace kitbag {
namespace {

constexpr uint16_t kPcmFormat = 1;
constexpr uint32_t kFmtChunkBytes = 16;
// RIFF counts everything after its own tag and size field.
constexpr uint32_t kRiffPreambleBytes = 8;
constexpr unsigned kByteBits = 8;
constexpr size_t kTagChars = 4;
constexpr unsigned kByteMask = 0xFF;
constexpr float kS16Max = std::numeric_limits<int16_t>::max();

void PutU16(std::vector<uint8_t>* out, uint16_t value) {
  out->push_back(static_cast<uint8_t>(value & kByteMask));
  out->push_back(static_cast<uint8_t>(value >> kByteBits));
}

void PutU32(std::vector<uint8_t>* out, uint32_t value) {
  for (unsigned shift = 0; shift < sizeof(uint32_t) * kByteBits;
       shift += kByteBits) {
    out->push_back(static_cast<uint8_t>((value >> shift) & kByteMask));
  }
}

int16_t ToS16(float sample) {
  const float clamped = std::clamp(sample, -1.0f, 1.0f);
  return static_cast<int16_t>(std::lround(clamped * kS16Max));
}

void PutTag(std::vector<uint8_t>* out, const char (&tag)[kTagChars + 1]) {
  out->insert(out->end(), tag, tag + kTagChars);
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
  std::vector<uint8_t> header;
  header.reserve(kHeaderBytes);
  PutTag(&header, "RIFF");
  PutU32(&header, kHeaderBytes - kRiffPreambleBytes + data);
  PutTag(&header, "WAVE");
  PutTag(&header, "fmt ");
  PutU32(&header, kFmtChunkBytes);
  PutU16(&header, kPcmFormat);
  PutU16(&header, kChannels);
  PutU32(&header, sample_rate_);
  PutU32(&header, sample_rate_ * kBytesPerFrame);
  PutU16(&header, kBytesPerFrame);
  PutU16(&header, static_cast<uint16_t>(kBitsPerSample));
  PutTag(&header, "data");
  PutU32(&header, data);
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
  std::error_code error;
  if (written && closed) std::filesystem::rename(part_, path_, error);
  if (!written || !closed || error) {
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
