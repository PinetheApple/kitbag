#ifndef KITBAG_TUNER_PITCH_DETECTOR_H
#define KITBAG_TUNER_PITCH_DETECTOR_H

// One-frame pitch by the McLeod pitch method (McLeod & Wyvill 2005; see
// docs/tuner-research.md §2), refined at a multiple of the period.
#include <vector>

namespace kitbag {

class PitchDetector {
 public:
  struct Estimate {
    double hz = 0.0;       // 0 when no period was found
    double clarity = 0.0;  // NSDF peak height, 1 for a perfectly periodic frame
  };

  // Allocates; call before Detect, off any realtime thread. frame_size must be
  // a power of two.
  void Init(int frame_size, double sample_rate);

  // frame: frame_size samples, oldest first. Reports pitches in [min_hz,
  // max_hz]; lags past half the frame are never searched. A pitch above max_hz
  // is rejected, or with fold_octaves reported octaves down when it divides
  // the in-range period by a power of two (spec §4.4).
  Estimate
  Detect(const float* frame, double min_hz, double max_hz, bool fold_octaves);

 private:
  void Autocorrelate(const float* frame);
  void Normalise(const float* frame, int max_lag);
  int PickPeak(int min_lag, int max_lag) const;
  bool IsOctaveFold(const float* frame, int above_lag, double period) const;
  double RefinePeriod(const float* frame, int lag) const;
  double InterpolatedPeak(const float* frame, int lag) const;
  double ExactNsdf(const float* frame, int lag) const;

  std::vector<float> spectrum_;  // interleaved complex, 2 x frame_size points
  std::vector<double> nsdf_;
  int frame_size_ = 0;
  double sample_rate_ = 0.0;
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_PITCH_DETECTOR_H
