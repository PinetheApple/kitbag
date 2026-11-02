#ifndef KITBAG_STRETCH_TIME_STRETCH_H
#define KITBAG_STRETCH_TIME_STRETCH_H

#include <memory>

namespace kitbag {

struct StretchConfig {
  int block_frames = 0;
  int interval_frames = 0;
  bool split_computation = false;
};

// Interleaved time-stretch and pitch shift over Signalsmith Stretch. Configure
// allocates; every other call does not. Call Configure first.
class TimeStretch {
 public:
  static constexpr float kBlockSeconds = 0.2f;
  static constexpr int kOverlap = 6;
  static constexpr bool kSplitComputation = true;
  // Past this many live instances every one runs the vendor presetDefault,
  // which the device bench puts at ~0.26 of a core for seven.
  static constexpr int kMaxChosenConfigInstances = 4;

  static StretchConfig DefaultConfig(float sample_rate);

  TimeStretch();
  ~TimeStretch();
  TimeStretch(const TimeStretch&) = delete;
  TimeStretch& operator=(const TimeStretch&) = delete;

  void Configure(int channels, float sample_rate);
  void Configure(int channels, const StretchConfig& config);
  void ConfigureVendorDefault(int channels, float sample_rate);
  void SetTransposeSemitones(float semitones);
  // Plays in_frames of input across out_frames of output, so the rate is
  // in_frames / out_frames. in and out must not overlap.
  void Process(const float* in, int in_frames, float* out, int out_frames);
  void Reset();
  // in holds in_frames ending at the new position; SeekFrames() is enough.
  void Seek(const float* in, int in_frames, double rate);
  int SeekFrames() const;
  // Resets, then pre-renders so the next Process output starts at in[0].
  // in_frames = SongLagFrames(rate) sets the rate.
  void OutputSeek(const float* in, int in_frames);
  int InputLatencyFrames() const;
  int OutputLatencyFrames() const;
  // Song frames between the newest input fed and the output now emitted.
  int SongLagFrames(double rate) const;

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
  int channels_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_STRETCH_TIME_STRETCH_H
