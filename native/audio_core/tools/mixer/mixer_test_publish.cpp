// A3 (SPEC.md §4.1, §2.2, design-audit F3): the two app→RT disciplines. Sources
// are built off-thread and swapped in by RtPublisher; every scalar control
// crosses the command ring and is applied by Process. These pin the observable
// semantics — command ordering and the swap's all-or-nothing output. The
// data-race freedom itself is argued structurally (release/acquire publish, SPSC
// ring), not tested: a single-threaded tool cannot make a race fail.
#include <chrono>
#include <memory>
#include <thread>

#include "media/audio_source.h"
#include "mixer_test_support.h"

namespace mixer_test {
namespace {

// A reader whose every ReadFrames blocks, and whose rate forces the mixer to
// own a resampler in the TrackSource. It never runs dry, so the read-ahead
// thread is still churning through the owned resampler at teardown — which is
// exactly when the dtor-order bug would read a freed reader.
class BlockingReader : public kitbag::SourceReader {
 public:
  uint32_t channels() const override {
    return kMono;
  }
  uint32_t sample_rate() const override {
    return 44100;  // != engine rate, so BuildTrackSource wraps it in a resampler
  }
  uint64_t total_frames() const override {
    return 2000000;  // far longer than any prime, so the thread never exhausts
  }
  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
    for (uint64_t i = 0; i < frames; ++i) dst[i] = static_cast<float>(pos_ + i);
    pos_ += frames;
    return {frames, kitbag::ReadStatus::kOk};
  }
  bool SeekToFrame(uint64_t frame) override {
    pos_ = frame;
    return true;
  }

 private:
  uint64_t pos_ = 0;
};

// Reports a caller-chosen channel count at the engine rate (no resampler), so a
// test can drive the kMaxChannels gate. ReadFrames is never reached: the reader
// is rejected at load.
class FixedChannelReader : public kitbag::SourceReader {
 public:
  explicit FixedChannelReader(uint32_t channels) : channels_(channels) {}
  uint32_t channels() const override {
    return channels_;
  }
  uint32_t sample_rate() const override {
    return kSampleRate;
  }
  uint64_t total_frames() const override {
    return kShortFrames;
  }
  kitbag::ReadResult ReadFrames(float*, uint64_t) override {
    return {0, kitbag::ReadStatus::kEndOfStream};
  }
  bool SeekToFrame(uint64_t) override {
    return true;
  }

 private:
  uint32_t channels_;
};

// A command takes effect when Process drains it, not when the setter is called.
// Synchronous seek — the pre-fix behaviour — would move position() immediately.
void TestSeekAppliesAtBlockNotBefore() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, kLongOffset);

  mixer.Seek(2000, 0, false);
  Check(
      mixer.position() == 0,
      "command: a seek is not applied until the block drains it"
  );
  Drain(&mixer);
  Check(
      mixer.position() == 2000,
      "command: the drained seek moves the head to the sought frame"
  );
}

// Controls apply in the order they were queued. Seek-then-Stop ends at zero
// (Stop is last); Stop-then-Seek ends at the sought frame. A drain that dropped
// or reordered a command would land on the wrong one.
void TestCommandsAppliedInOrder() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, kLongOffset);

  mixer.Seek(3000, 0, false);
  mixer.Stop(0, false);
  Drain(&mixer);
  Check(
      mixer.position() == 0,
      "order: seek then stop lands on stop's rewind, not the seek"
  );

  mixer.Stop(0, false);
  mixer.Seek(3000, 0, false);
  Drain(&mixer);
  Check(
      mixer.position() == 3000,
      "order: stop then seek lands on the later seek, not the rewind"
  );
}

// gain/mute/solo cross the ring too, so the getter reflects the value only after
// a block drains the command — not the moment the setter returns.
void TestScalarControlsCrossTheRing() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);

  mixer.SetGain(0, 0.5f);
  Check(
      mixer.gain(0) == 1.0f,
      "scalar: gain is unchanged until the block drains the command"
  );
  Drain(&mixer);
  Check(
      mixer.gain(0) == 0.5f,
      "scalar: the drained command updates the published gain mirror"
  );
}

// Publishing a new source mid-playback yields fully-new output, never a torn or
// half-built read: the callback sees one atomic swap. Offsets 0 and kLongOffset
// name which source landed, so a stale-source read shows as ~512, not 100000.
void TestPublishSwapsToNewSourceWhole() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);
  mixer.Play();
  const std::vector<float> first = RenderBlock(&mixer);
  ExpectSample(
      first,
      0,
      0.0f,
      "publish: the first source plays from its frame 0"
  );

  LoadRamp(&mixer, 0, kLongFrames, kLongOffset);
  mixer.Play();  // start + prime the freshly published source
  const std::vector<float> after = RenderBlock(&mixer);
  ExpectSample(
      after,
      0,
      kLongOffset,
      "publish: the swap delivers the new source whole, not the old one"
  );
}

// The dtor-order fix: destroying a mixer with a live read-ahead thread must join
// the thread (the source dtor's job) before the owned resampler it reads through
// is destroyed. With `source` declared first it is destroyed last, so the thread
// keeps calling into a freed resampler — a use-after-free ASan catches. The
// blocking reader keeps the thread mid-read across the teardown; run under ASan
// to make this discriminate, else it only asserts no crash/hang.
void TestDestroyWithLiveReadAheadThread() {
  BlockingReader reader;  // caller-owned, outlives the mixer below
  {
    kitbag::Mixer mixer(kSampleRate);
    mixer.SetTrackSource(0, &reader, 0, false);
    mixer.Play();  // read-ahead thread now churning through the owned resampler
    // No Stop(): the mixer dtor must join the thread before the resampler dies.
  }
  Check(
      true,
      "teardown: destroying a playing mixer joins the read-ahead thread"
  );
}

// scratch_ is sized for stereo at construction and never reallocated, so loading
// a wider (stereo) track while a mono track plays cannot free the drain buffer
// under the callback. Single-threaded, this cannot show that race; it pins the
// behaviour on the previously-hidden widening path — the stereo track loads and
// mixes correctly beside the still-advancing mono one.
void TestWiderTrackLoadsDuringPlayback() {
  kitbag::Mixer mixer(kSampleRate);
  LoadRamp(&mixer, 0, kLongFrames, 0.0f);  // mono, playing first
  mixer.Play();
  RenderBlock(&mixer);  // mono advances to kBlock

  LoadInterleaved(
      &mixer,
      1,
      kLongFrames,
      kStereo,
      kLongOffset
  );             // widen mid-play
  mixer.Play();  // start + prime the new stereo source
  const std::vector<float> out = RenderBlock(&mixer);
  // Left = mono@kBlock + stereo L frame 0; right = mono@kBlock + stereo R frame 0.
  ExpectChannel(
      out,
      0,
      0,
      static_cast<float>(kBlock) + kLongOffset,
      "widen: stereo left mixes with the continuing mono track"
  );
  ExpectChannel(
      out,
      0,
      1,
      static_cast<float>(kBlock) + kLongOffset + 1.0f,
      "widen: stereo right is the distinct interleaved sample"
  );
}

// scratch_ is fixed at kMaxChannels, so a track wider than stereo is rejected at
// load rather than reallocating the buffer on the callback path. A zero-channel
// source is rejected the same way. A rejected load publishes nothing, so the
// track stays empty.
void TestTooWideTrackIsRejected() {
  kitbag::Mixer mixer(kSampleRate);
  FixedChannelReader three_channel(3);
  Check(
      !mixer.SetTrackSource(0, &three_channel, 0, false),
      "reject: a 3-channel source is refused at load"
  );
  Check(
      mixer.track_frames(0) == 0,
      "reject: the refused wide track publishes nothing"
  );

  FixedChannelReader zero_channel(0);
  Check(
      !mixer.SetTrackSource(1, &zero_channel, 0, false),
      "reject: a 0-channel source is refused at load"
  );
}

}  // namespace

void RunPublishTests() {
  TestSeekAppliesAtBlockNotBefore();
  TestCommandsAppliedInOrder();
  TestScalarControlsCrossTheRing();
  TestPublishSwapsToNewSourceWhole();
  TestDestroyWithLiveReadAheadThread();
  TestWiderTrackLoadsDuringPlayback();
  TestTooWideTrackIsRejected();
}

}  // namespace mixer_test
