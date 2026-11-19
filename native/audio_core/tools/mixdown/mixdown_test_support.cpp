#include "mixdown_test_support.h"

#include <unistd.h>

#include <cmath>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <limits>
#include <numbers>

#include "wav_fixture.h"

namespace mixdown_test {
namespace {

constexpr size_t kHeaderBytes = 44;
constexpr size_t kRiffSizeAt = 4;
constexpr size_t kFormatAt = 20;
constexpr size_t kChannelsAt = 22;
constexpr size_t kRateAt = 24;
constexpr size_t kBitsAt = 34;
constexpr size_t kDataSizeAt = 40;
constexpr unsigned kByteBits = 8;
constexpr uint32_t kLcgMultiplier = 1664525U;
constexpr uint32_t kLcgIncrement = 1013904223U;
constexpr float kNoiseAmplitude = 0.3f;

uint32_t U32At(const std::vector<uint8_t>& bytes, size_t at) {
  uint32_t value = 0;
  for (size_t i = 0; i < sizeof(uint32_t); ++i) {
    value |= static_cast<uint32_t>(bytes[at + i]) << (i * kByteBits);
  }
  return value;
}

uint16_t U16At(const std::vector<uint8_t>& bytes, size_t at) {
  return static_cast<uint16_t>(bytes[at] | (bytes[at + 1] << kByteBits));
}

std::vector<std::string>& TempFiles() {
  static std::vector<std::string> files;
  return files;
}

}  // namespace

WavFile ReadWav(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  const std::vector<uint8_t> bytes(
      (std::istreambuf_iterator<char>(in)),
      std::istreambuf_iterator<char>()
  );
  WavFile wav;
  wav.file_bytes = bytes.size();
  if (bytes.size() < kHeaderBytes) return wav;
  wav.riff_bytes = U32At(bytes, kRiffSizeAt);
  wav.format = U16At(bytes, kFormatAt);
  wav.channels = U16At(bytes, kChannelsAt);
  wav.sample_rate = U32At(bytes, kRateAt);
  wav.bits = U16At(bytes, kBitsAt);
  wav.data_bytes = U32At(bytes, kDataSizeAt);
  for (size_t at = kHeaderBytes; at + 1 < bytes.size(); at += sizeof(int16_t)) {
    wav.samples.push_back(static_cast<int16_t>(U16At(bytes, at)));
  }
  wav.parsed = true;
  return wav;
}

uint64_t WavFrames(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  std::vector<uint8_t> header(kHeaderBytes);
  in.read(reinterpret_cast<char*>(header.data()), kHeaderBytes);
  if (!in) return 0;
  const uint32_t data = U32At(header, kDataSizeAt);
  std::error_code error;
  const uintmax_t size = std::filesystem::file_size(path, error);
  if (error || size != kHeaderBytes + data) return 0;
  return data / (kStereo * sizeof(int16_t));
}

bool Exists(const std::string& path) {
  return std::filesystem::exists(path);
}

std::string TempPath(const std::string& name, const char* extension) {
  const std::string file =
      "kitbag_mixdown_" + name + "_" + std::to_string(getpid()) + extension;
  const std::string path =
      (std::filesystem::temp_directory_path() / file).string();
  RemoveLater(path);
  RemoveLater(path + kitbag::WavWriter::kPartSuffix);
  return path;
}

void RemoveLater(const std::string& path) {
  TempFiles().push_back(path);
}

void RemoveTempFiles() {
  std::error_code error;
  for (const std::string& path : TempFiles()) {
    std::filesystem::remove_all(path, error);
  }
  TempFiles().clear();
}

std::vector<float> Noise(uint64_t frames, uint32_t channels, uint32_t seed) {
  std::vector<float> pcm(frames * channels);
  uint32_t state = seed;
  for (float& sample : pcm) {
    state = state * kLcgMultiplier + kLcgIncrement;
    const double unit =
        static_cast<double>(state) / std::numeric_limits<uint32_t>::max();
    sample = kNoiseAmplitude * static_cast<float>(2.0 * unit - 1.0);
  }
  return pcm;
}

std::vector<float> Sine(uint64_t frames, double hz, float amplitude) {
  std::vector<float> pcm(frames);
  for (uint64_t i = 0; i < frames; ++i) {
    const double phase = 2.0 * std::numbers::pi * hz * i / kSampleRate;
    pcm[i] = amplitude * static_cast<float>(std::sin(phase));
  }
  return pcm;
}

std::string WriteStem(
    const std::string& name,
    const std::vector<float>& pcm,
    uint32_t channels,
    uint32_t rate
) {
  const std::string path = TempPath(name, ".wav");
  if (!media_test::WriteFloatWav(path, pcm, channels, rate)) {
    std::fprintf(stderr, "FIXTURE FAIL: could not write %s\n", path.c_str());
    ++g_failures;
  }
  return path;
}

}  // namespace mixdown_test
