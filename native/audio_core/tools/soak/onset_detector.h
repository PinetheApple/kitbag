#ifndef KITBAG_TOOLS_SOAK_ONSET_DETECTOR_H
#define KITBAG_TOOLS_SOAK_ONSET_DETECTOR_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace click_soak {

struct DetectionLevels {
  double click_peak = 0.0;
  double noise_floor = 0.0;
  double threshold = 0.0;
};

class BlockPeakMeter {
 public:
  explicit BlockPeakMeter(uint32_t sample_rate);
  void Feed(const float* mono, size_t count);
  std::vector<float> Finish();
  size_t block_frames() const {
    return block_frames_;
  }

 private:
  size_t block_frames_;
  size_t filled_ = 0;
  float peak_ = 0.0F;
  std::vector<float> peaks_;
};

// click_peak stays 0 when no window rises above the noise gate.
DetectionLevels EstimateLevels(
    const std::vector<float>& block_peaks,
    size_t block_frames,
    uint32_t sample_rate,
    double beat_sec
);

class OnsetDetector {
 public:
  OnsetDetector(uint32_t sample_rate, const DetectionLevels& levels);
  void Feed(const float* mono, size_t count);
  const std::vector<double>& onsets_sec() const {
    return onsets_sec_;
  }

 private:
  void Step(float sample);
  int64_t FirstFrameOfAttack() const;
  double EnvelopeAt(int64_t frame) const;

  double sample_rate_;
  double release_;
  double threshold_;
  double rearm_level_;
  double onset_level_;
  std::vector<double> history_;
  int64_t frame_ = 0;
  double envelope_ = 0.0;
  bool armed_ = true;
  std::vector<double> onsets_sec_;
};

std::vector<double> DetectOnsets(
    const std::vector<float>& mono,
    uint32_t sample_rate,
    double beat_sec,
    DetectionLevels* levels
);

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_ONSET_DETECTOR_H
