#include "metronome/click_sound_prepare.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <system_error>
#include <utility>

#include "media/mono_file_stream.h"
#include "media/riff_bytes.h"
#include "metronome/custom_sound_limits.h"

namespace kitbag {

namespace {

constexpr uint16_t kFloatFormat = 3;
constexpr uint16_t kMonoChannels = 1;
constexpr uint16_t kFloatBits = 32;
constexpr uint32_t kFloatHeaderBytes = 44;
// The linear resampler can round a converted length up by one frame.
constexpr uint32_t kResampleRoundingFrames = 1;
constexpr const char* kPartSuffix = ".part";

struct Kept {
  std::vector<float> samples;
  size_t max_frames = 0;
  bool trim = false;
  bool heard = false;
  size_t audible_end = 0;
  float peak = 0.0F;
};

// Past the limit only silence may follow when trimming; the trim drops it.
kb_result Keep(float sample, Kept* kept) {
  const float level = std::fabs(sample);
  const bool audible = level >= kClickSoundOnsetLevel;
  if (kept->trim && !kept->heard && !audible) return KB_OK;
  kept->heard = true;
  if (kept->samples.size() == kept->max_frames) {
    return kept->trim && !audible ? KB_OK : KB_ERROR_TOO_LONG;
  }
  kept->samples.push_back(sample);
  if (audible) kept->audible_end = kept->samples.size();
  kept->peak = std::max(kept->peak, level);
  return KB_OK;
}

kb_result Append(const float* mono, uint32_t frames, Kept* kept) {
  for (uint32_t i = 0; i < frames; ++i) {
    if (!std::isfinite(mono[i])) return KB_ERROR_INVALID_ARGUMENT;
    const kb_result kept_one = Keep(mono[i], kept);
    if (kept_one != KB_OK) return kept_one;
  }
  return KB_OK;
}

kb_result Drain(const char* path, uint32_t rate, Kept* kept) {
  MonoFileStream stream;
  if (path == nullptr || !stream.Open(path, rate)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kept->samples.reserve(kept->max_frames);
  std::vector<float> chunk(MonoFileStream::kChunkFrames);
  uint32_t got = 0;
  while ((got = stream.Read(chunk.data(), MonoFileStream::kChunkFrames)) > 0) {
    const kb_result result = Append(chunk.data(), got, kept);
    if (result != KB_OK) return result;
  }
  return KB_OK;
}

std::vector<uint8_t> FloatWavHeader(uint32_t frames) {
  const uint32_t block = kMonoChannels * sizeof(float);
  const uint32_t data = frames * block;
  std::vector<uint8_t> header;
  header.reserve(kFloatHeaderBytes);
  riff::PutTag(&header, "RIFF");
  riff::PutU32(&header, kFloatHeaderBytes - riff::kRiffPreambleBytes + data);
  riff::PutTag(&header, "WAVE");
  riff::PutTag(&header, "fmt ");
  riff::PutU32(&header, riff::kFmtChunkBytes);
  riff::PutU16(&header, kFloatFormat);
  riff::PutU16(&header, kMonoChannels);
  riff::PutU32(&header, kCustomSoundRate);
  riff::PutU32(&header, kCustomSoundRate * block);
  riff::PutU16(&header, static_cast<uint16_t>(block));
  riff::PutU16(&header, kFloatBits);
  riff::PutTag(&header, "data");
  riff::PutU32(&header, data);
  return header;
}

// Samples go out in host order: every target this core builds for is
// little-endian, which is what RIFF stores.
bool WriteFile(const std::string& path, const std::vector<float>& samples) {
  std::FILE* file = std::fopen(path.c_str(), "wb");
  if (file == nullptr) return false;
  const std::vector<uint8_t> header =
      FloatWavHeader(static_cast<uint32_t>(samples.size()));
  bool written =
      std::fwrite(header.data(), 1, header.size(), file) == header.size();
  written = written &&
            std::fwrite(samples.data(), sizeof(float), samples.size(), file) ==
                samples.size();
  return std::fclose(file) == 0 && written;
}

kb_result
WriteMonoFloatWav(const char* path, const std::vector<float>& samples) {
  const std::string part = std::string(path) + kPartSuffix;
  std::error_code error;
  const bool written = WriteFile(part, samples);
  if (written) std::filesystem::rename(part, path, error);
  if (written && !error) return KB_OK;
  std::remove(part.c_str());
  return KB_ERROR_INTERNAL;
}

}  // namespace

kb_result PrepareClickSound(const char* in_path, const char* out_path) {
  if (out_path == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  Kept kept;
  kept.trim = true;
  kept.max_frames =
      static_cast<size_t>(kMaxCustomSoundSeconds) * kCustomSoundRate;
  const kb_result drained = Drain(in_path, kCustomSoundRate, &kept);
  if (drained != KB_OK) return drained;
  if (!kept.heard) return KB_ERROR_SILENT;
  kept.samples.resize(kept.audible_end);
  const float gain = kClickSoundPeak / kept.peak;
  for (float& sample : kept.samples) sample *= gain;
  return WriteMonoFloatWav(out_path, kept.samples);
}

kb_result
LoadClickSound(const char* path, uint32_t rate, std::vector<float>* out) {
  Kept kept;
  kept.heard = true;
  kept.max_frames = static_cast<size_t>(kMaxCustomSoundSeconds) * rate +
                    kResampleRoundingFrames;
  const kb_result drained = Drain(path, rate, &kept);
  if (drained != KB_OK) return drained;
  if (kept.samples.empty()) return KB_ERROR_INVALID_ARGUMENT;
  *out = std::move(kept.samples);
  return KB_OK;
}

}  // namespace kitbag
