#include "stretch/time_stretch.h"

#include <signalsmith-stretch.h>

namespace kitbag {
namespace {

// The default constructor reads std::random_device; a fixed seed does not.
constexpr long kSeed = 1;

struct ConstStrided {
  const float* base;
  int stride;
  float operator[](int i) const {
    return base[i * stride];
  }
};

struct Strided {
  float* base;
  int stride;
  float& operator[](int i) const {
    return base[i * stride];
  }
};

struct ConstInterleaved {
  const float* data;
  int channels;
  ConstStrided operator[](int c) const {
    return {data + c, channels};
  }
};

struct Interleaved {
  float* data;
  int channels;
  Strided operator[](int c) const {
    return {data + c, channels};
  }
};

}  // namespace

struct TimeStretch::Impl {
  signalsmith::stretch::SignalsmithStretch<float> stretch{kSeed};
};

TimeStretch::TimeStretch() = default;
TimeStretch::~TimeStretch() = default;

void TimeStretch::Configure(int channels, float sample_rate) {
  const auto block = static_cast<int>(sample_rate * kBlockSeconds);
  Configure(
      channels,
      {.block_frames = block,
       .interval_frames = block / kOverlap,
       .split_computation = kSplitComputation}
  );
}

void TimeStretch::Configure(int channels, const StretchConfig& config) {
  channels_ = channels;
  impl_ = std::make_unique<Impl>();
  impl_->stretch.configure(
      channels,
      config.block_frames,
      config.interval_frames,
      config.split_computation
  );
}

void TimeStretch::SetTransposeSemitones(float semitones) {
  impl_->stretch.setTransposeSemitones(semitones);
}

void TimeStretch::Process(
    const float* in,
    int in_frames,
    float* out,
    int out_frames
) {
  impl_->stretch.process(
      ConstInterleaved{in, channels_},
      in_frames,
      Interleaved{out, channels_},
      out_frames
  );
}

void TimeStretch::Reset() {
  impl_->stretch.reset();
}

void TimeStretch::Seek(const float* in, int in_frames, double rate) {
  impl_->stretch.seek(ConstInterleaved{in, channels_}, in_frames, rate);
}

int TimeStretch::SeekFrames() const {
  return impl_->stretch.seekLength();
}

int TimeStretch::SongLagFrames(double rate) const {
  return impl_->stretch.outputSeekLength(static_cast<float>(rate));
}

}  // namespace kitbag
