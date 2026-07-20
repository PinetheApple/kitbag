// Streaming behaviour of AudioSource through the in-memory adapter: exact
// frame counts, byte-exact order across ring wraps, and end of stream.
#include <algorithm>
#include <cstdio>
#include <vector>

#include "audio_source_drain.h"
#include "media/audio_source.h"
#include "media_test_support.h"
#include "memory_audio_reader.h"

namespace media_test {
namespace {

using kitbag::AudioSource;

bool OpenAndStart(AudioSource* source, MemoryAudioReader* reader) {
  return source->Open(reader, kRingFrames) && source->Start();
}

void TestBlockSize(uint32_t block) {
  MemoryAudioReader reader(RampSamples(kTotalFrames, kChannels), kChannels);
  AudioSource source;
  kitbag_test::Check(OpenAndStart(&source, &reader), "stream: source starts");

  const DrainResult result = Drain(&source, block, 0);
  char label[64];
  std::snprintf(label, sizeof(label), "stream: block %u frame count", block);
  kitbag_test::Check(result.frames == kTotalFrames && !result.timed_out, label);
  std::snprintf(label, sizeof(label), "stream: block %u sample order", block);
  kitbag_test::Check(result.integrity, label);
  std::snprintf(label, sizeof(label), "stream: block %u zero fill", block);
  kitbag_test::Check(result.zero_fill, label);
  std::snprintf(label, sizeof(label), "stream: block %u position", block);
  kitbag_test::Check(source.position() == kTotalFrames, label);
}

void TestEndOfStream() {
  MemoryAudioReader reader(RampSamples(kTotalFrames, kChannels), kChannels);
  AudioSource source;
  OpenAndStart(&source, &reader);
  const DrainResult result = Drain(&source, 256, 0);
  kitbag_test::Check(result.frames == kTotalFrames, "eof: drained every frame");
  kitbag_test::Check(source.is_at_end(), "eof: reports end after the drain");

  std::vector<float> dst(256 * kChannels, kPoison);
  const uint32_t got = source.Read(dst.data(), 256);
  kitbag_test::Check(got == 0, "eof: read past the end delivers nothing");
  const bool silent = std::all_of(dst.begin(), dst.end(), [](float sample) {
    return sample == 0.0F;
  });
  kitbag_test::Check(silent, "eof: read past the end zero-fills");
  kitbag_test::Check(
      source.position() == kTotalFrames,
      "eof: position stops at the last frame"
  );
}

void TestStreamMetadata() {
  MemoryAudioReader reader(RampSamples(1000, 1), 1, 48000);
  AudioSource source;
  OpenAndStart(&source, &reader);
  kitbag_test::Check(source.channels() == 1, "stream: mono channel count");
  kitbag_test::Check(
      source.sample_rate() == 48000,
      "stream: sample rate comes off the reader"
  );
  const DrainResult result = Drain(&source, 64, 0);
  kitbag_test::Check(result.frames == 1000, "stream: mono frame count");
  kitbag_test::Check(result.integrity, "stream: mono sample order");
}

// ring_frames == 1 is the only input that drives ChunkFrames' half == 0
// branch; nothing else in the suite reaches it.
void TestSingleFrameRing() {
  MemoryAudioReader reader(RampSamples(37, 1), 1);
  AudioSource source;
  kitbag_test::Check(source.Open(&reader, 1), "tiny ring: opens");
  source.Start();
  const DrainResult result = Drain(&source, 4, 0);
  kitbag_test::Check(result.frames == 37, "tiny ring: frame count");
  kitbag_test::Check(result.integrity, "tiny ring: sample order");
}

}  // namespace

void RunStreamTests() {
  // 1000 exceeds the ring, so every read is short: the short-read path is
  // exercised as a normal case, not only at the end.
  for (uint32_t block : {1U, 7U, 128U, 255U, 257U, 480U, 1000U}) {
    TestBlockSize(block);
  }
  TestEndOfStream();
  TestStreamMetadata();
  TestSingleFrameRing();
}

}  // namespace media_test
