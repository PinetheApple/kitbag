// A1 (SPEC.md §4.1): each track streams through an AudioSource the callback
// drains. These prove the mixer consumes the source in bounded chunks rather
// than holding the whole decoded song, and that the drain delivers its samples.
#include <atomic>
#include <vector>

#include "media/audio_source.h"
#include "mixer_test_support.h"

namespace mixer_test {
namespace {

// A streaming SourceReader whose every sample is its own absolute index (plus
// an offset), so a dropped or replayed span shows as a wrong value. It counts
// its pulls so a test can tell chunked streaming from a single whole-song read.
class CountingRampReader : public kitbag::SourceReader {
 public:
  CountingRampReader(uint64_t frames, uint32_t channels, float offset)
      : frames_(frames), channels_(channels), offset_(offset) {}

  uint32_t channels() const override {
    return channels_;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return frames_;
  }

  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    read_calls.fetch_add(1);
    if (frames > max_request.load()) max_request.store(frames);
    const uint64_t avail = pos_ < frames_ ? frames_ - pos_ : 0;
    const uint64_t n = frames < avail ? frames : avail;
    for (uint64_t i = 0; i < n * channels_; ++i) {
      dst[i] = offset_ + static_cast<float>((pos_ * channels_) + i);
    }
    pos_ += n;
    return {
        n,
        n == frames ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > frames_) return false;
    pos_ = frame;
    return true;
  }

  std::atomic<uint64_t> read_calls{0};
  std::atomic<uint64_t> max_request{0};

 private:
  uint64_t frames_;
  uint32_t channels_;
  float offset_;
  uint64_t pos_ = 0;
};

// The whole point of A1: memory is O(tracks), not O(duration). A 20000-frame
// song is far longer than the ring, so a mixer that buffered the whole thing
// would report track_buffered() near 20000 rather than a ring's worth.
void TestStreamsRatherThanBuffersWholeSong() {
  const uint64_t frames = 20000;
  CountingRampReader reader(frames, kMono, 0.0f);
  kitbag::Mixer mixer(kSampleRate);
  Check(
      mixer.SetTrackSource(0, &reader),
      "source: SetTrackSource accepts a streaming reader"
  );
  Check(
      mixer.track_frames(0) == frames,
      "source: the track reports its length"
  );
  mixer.Play();
  Check(
      mixer.track_buffered(0) <= kitbag::AudioSource::kDefaultRingFrames,
      "source: buffering is bounded by the ring"
  );
  Check(
      mixer.track_buffered(0) < frames,
      "source: the mixer holds far less than the whole 20000-frame song"
  );
  mixer.Stop();
}

// Streaming pulls the reader repeatedly in bounded chunks. A reimplementation
// that read the whole song once would request all 4000 frames in one call.
void TestConsumesSourceInChunksNotOneShot() {
  const uint64_t frames = 4000;
  CountingRampReader reader(frames, kMono, 0.0f);
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetTrackSource(0, &reader);
  mixer.Play();
  for (int b = 0; b < 4; ++b) RenderBlock(&mixer);
  mixer.Stop();
  Check(
      reader.read_calls.load() > 1,
      "source: the reader is pulled repeatedly, not read once"
  );
  Check(
      reader.max_request.load() <= 512,
      "source: each pull is a bounded chunk, never the whole song"
  );
}

bool AnyNonZero(const std::vector<float>& out) {
  for (float s : out) {
    if (s != 0.0f) return true;
  }
  return false;
}

// The drain must deliver the source's actual samples, in order and non-silent.
void TestDrainDeliversSourceSamples() {
  CountingRampReader reader(3000, kMono, kLongOffset);
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetTrackSource(0, &reader);
  mixer.Play();

  const std::vector<float> b0 = RenderBlock(&mixer);
  ExpectSample(
      b0,
      0,
      kLongOffset,
      "drain: first sample is the source's frame 0"
  );
  ExpectSample(
      b0,
      100,
      kLongOffset + 100.0f,
      "drain: the sample tracks the source frame index"
  );
  ExpectSample(
      b0,
      kBlock - 1,
      kLongOffset + static_cast<float>(kBlock - 1),
      "drain: the block's last sample"
  );
  Check(AnyNonZero(b0), "drain: the block is not silent");
  Check(mixer.position() == kBlock, "drain: the transport advanced one block");
  mixer.Stop();
}

// A second block must continue from where the first left off, not replay it.
void TestDrainContinuesNotReplays() {
  CountingRampReader reader(3000, kMono, kLongOffset);
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetTrackSource(0, &reader);
  mixer.Play();

  RenderBlock(&mixer);
  const std::vector<float> b1 = RenderBlock(&mixer);
  ExpectSample(
      b1,
      0,
      kLongOffset + static_cast<float>(kBlock),
      "drain: the next block continues rather than replays"
  );
  mixer.Stop();
}

// A source shorter than a whole number of blocks drains to its last frame, pads
// the rest of the final block with silence, reports end of stream, and stops.
void TestSourceDrainsToEndThenStops() {
  const uint64_t frames = 1300;
  CountingRampReader reader(frames, kMono, 0.0f);
  kitbag::Mixer mixer(kSampleRate);
  mixer.SetTrackSource(0, &reader);
  mixer.Play();

  RenderBlock(&mixer);
  RenderBlock(&mixer);
  const std::vector<float> tail = RenderBlock(&mixer);
  ExpectSample(tail, 275, 1299.0f, "end: the source's last frame still sounds");
  ExpectSample(tail, 276, 0.0f, "end: past the source end is silent");
  Check(mixer.track_at_end(0), "end: the drained source reports end of stream");
  Check(mixer.is_playing(), "end: the finishing block still plays");

  RenderBlock(&mixer);
  Check(!mixer.is_playing(), "end: playback stops after the last frame");
  mixer.Stop();
}

}  // namespace

void RunSourceTests() {
  TestStreamsRatherThanBuffersWholeSong();
  TestConsumesSourceInChunksNotOneShot();
  TestDrainDeliversSourceSamples();
  TestDrainContinuesNotReplays();
  TestSourceDrainsToEndThenStops();
}

}  // namespace mixer_test
