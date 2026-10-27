#ifndef KITBAG_ANALYSIS_DOWNBEAT_H
#define KITBAG_ANALYSIS_DOWNBEAT_H

#include <cstddef>
#include <cstdint>
#include <memory>
#include <vector>

class Decimator;
class FFTReal;

namespace kitbag {

/// Streaming port of QM-DSP DownBeat::findDownBeats, holding one beat of
/// decimated audio. Beats must ascend; beats_per_bar <= 0 means 4/4.
class DownbeatTracker {
 public:
  DownbeatTracker(
      int sample_rate,
      const std::vector<float>& beat_times,
      uint64_t total_frames,
      int beats_per_bar
  );
  ~DownbeatTracker();
  DownbeatTracker(const DownbeatTracker&) = delete;
  DownbeatTracker& operator=(const DownbeatTracker&) = delete;

  void Push(const float* mono, size_t count);

  /// Empty when there are fewer than two beats or the pushed audio fell short
  /// of total_frames.
  std::vector<int> Finish();

  /// Spectral difference across each inner beat boundary; valid after Finish.
  const std::vector<double>& beat_sd() const {
    return beat_sd_;
  }

 private:
  struct BeatSpan {
    size_t start = 0;
    size_t length = 0;
  };

  BeatSpan SpanOf(size_t beat) const;
  void PushBlock();
  void ProcessReadyBeats();
  void ProcessBeat(const BeatSpan& span);
  void DropBefore(size_t position);
  std::vector<int> PickDownbeats() const;

  std::vector<double> beats_;
  int beats_per_bar_;
  size_t audio_length_;
  size_t frame_size_;
  std::unique_ptr<Decimator> stage1_;
  std::unique_ptr<Decimator> stage2_;
  std::unique_ptr<FFTReal> fft_;
  std::vector<float> block_;
  std::vector<float> stage1_out_;
  size_t block_filled_ = 0;
  std::vector<float> decimated_;
  size_t decimated_start_ = 0;
  size_t next_beat_ = 0;
  std::vector<double> frame_;
  std::vector<double> real_out_;
  std::vector<double> imag_out_;
  std::vector<double> old_spec_;
  std::vector<double> beat_sd_;
};

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_DOWNBEAT_H
