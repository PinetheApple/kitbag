#include "metronome/click_sound_prepare.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <utility>

#include "media/mono_file_stream.h"
#include "media/part_file.h"
#include "media/riff_bytes.h"
#include "metronome/custom_sound_limits.h"

namespace kitbag {

namespace {

constexpr uint16_t kFloatFormat = 3;
constexpr uint16_t kFloatBits = 32;
constexpr riff::WavFormat kPreparedWav{
    kFloatFormat,
    1,
    kCustomSoundRate,
    kFloatBits
};
// The linear resampler can round a converted length up by one frame.
constexpr uint32_t kResampleRoundingFrames = 1;
constexpr size_t kPreparedMaxFrames =
    static_cast<size_t>(kMaxCustomSoundSeconds) * kCustomSoundRate;
constexpr auto kTailFadeFrames =
    static_cast<size_t>(kClickSoundTailFadeSeconds * kCustomSoundRate);

struct Trimmed {
  std::vector<float> samples;
  bool heard = false;
  size_t audible_end = 0;
};

// Past the limit only silence may follow; the trailing trim drops it.
kb_result TrimStep(float sample, Trimmed* trimmed) {
  const bool audible = std::fabs(sample) >= kClickSoundOnsetLevel;
  if (!trimmed->heard && !audible) return KB_OK;
  trimmed->heard = true;
  if (trimmed->samples.size() == kPreparedMaxFrames) {
    return audible ? KB_ERROR_TOO_LONG : KB_OK;
  }
  trimmed->samples.push_back(sample);
  if (audible) trimmed->audible_end = trimmed->samples.size();
  return KB_OK;
}

template <typename Step>
kb_result Drain(MonoFileStream& stream, Step step) {
  std::vector<float> chunk(MonoFileStream::kChunkFrames);
  uint32_t got = 0;
  while ((got = stream.Read(chunk.data(), MonoFileStream::kChunkFrames)) > 0) {
    for (uint32_t i = 0; i < got; ++i) {
      if (!std::isfinite(chunk[i])) return KB_ERROR_INVALID_ARGUMENT;
      const kb_result result = step(chunk[i]);
      if (result != KB_OK) return result;
    }
  }
  return stream.failed() ? KB_ERROR_INVALID_ARGUMENT : KB_OK;
}

// Never reaches the first sample, so the peak below stays audible.
void FadeTail(std::vector<float>* samples) {
  const size_t fade = std::min(kTailFadeFrames, samples->size() - 1);
  const size_t start = samples->size() - fade;
  for (size_t i = 0; i < fade; ++i) {
    (*samples)[start + i] *=
        static_cast<float>(fade - 1 - i) / static_cast<float>(fade);
  }
}

void MatchPeak(std::vector<float>* samples) {
  float peak = 0.0F;
  for (const float sample : *samples) peak = std::max(peak, std::fabs(sample));
  const float gain = kClickSoundPeak / peak;
  for (float& sample : *samples) sample *= gain;
}

kb_result ToResult(FileWrite write) {
  switch (write) {
    case FileWrite::kOk:
      return KB_OK;
    case FileWrite::kNoSpace:
      return KB_ERROR_NO_SPACE;
    case FileWrite::kFailed:
      return KB_ERROR_INTERNAL;
  }
  return KB_ERROR_INTERNAL;
}

// Samples go out in host order: every target this core builds for is
// little-endian, which is what RIFF stores.
kb_result WritePrepared(const char* path, const std::vector<float>& samples) {
  const auto bytes = static_cast<uint32_t>(samples.size() * sizeof(float));
  const std::vector<uint8_t> header = riff::WavHeader(kPreparedWav, bytes);
  return ToResult(WritePartFile(path, [&](std::FILE* file) {
    return std::fwrite(header.data(), 1, header.size(), file) ==
               header.size() &&
           std::fwrite(samples.data(), sizeof(float), samples.size(), file) ==
               samples.size();
  }));
}

kb_result PrepareStream(MonoFileStream& stream, const char* out_path) {
  Trimmed trimmed;
  trimmed.samples.reserve(kPreparedMaxFrames);
  const kb_result drained = Drain(stream, [&trimmed](float sample) {
    return TrimStep(sample, &trimmed);
  });
  if (drained != KB_OK) return drained;
  if (!trimmed.heard) return KB_ERROR_SILENT;
  trimmed.samples.resize(trimmed.audible_end);
  FadeTail(&trimmed.samples);
  MatchPeak(&trimmed.samples);
  return WritePrepared(out_path, trimmed.samples);
}

}  // namespace

kb_result PrepareClickSound(const char* in_path, const char* out_path) {
  MonoFileStream stream;
  if (in_path == nullptr || out_path == nullptr ||
      !stream.Open(in_path, kCustomSoundRate)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return PrepareStream(stream, out_path);
}

kb_result PrepareClickSoundFrom(SourceReader* source, const char* out_path) {
  MonoFileStream stream;
  if (source == nullptr || out_path == nullptr ||
      !stream.Open(source, kCustomSoundRate)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  return PrepareStream(stream, out_path);
}

kb_result
LoadClickSound(const char* path, uint32_t rate, std::vector<float>* out) {
  MonoFileStream stream;
  if (path == nullptr || !stream.Open(path, rate)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  const size_t max_frames = static_cast<size_t>(kMaxCustomSoundSeconds) * rate +
                            kResampleRoundingFrames;
  std::vector<float> samples;
  samples.reserve(max_frames);
  const kb_result drained = Drain(stream, [&](float sample) {
    if (samples.size() == max_frames) return KB_ERROR_TOO_LONG;
    samples.push_back(sample);
    return KB_OK;
  });
  if (drained != KB_OK) return drained;
  if (samples.empty()) return KB_ERROR_INVALID_ARGUMENT;
  samples.shrink_to_fit();
  *out = std::move(samples);
  return KB_OK;
}

}  // namespace kitbag
