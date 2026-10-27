#ifndef KITBAG_ANALYSIS_ONSET_ENVELOPE_H
#define KITBAG_ANALYSIS_ONSET_ENVELOPE_H

#include <cstddef>
#include <vector>

namespace kitbag {

// Independent of sample rate.
constexpr int kOnsetFftSize = 2048;
constexpr int kOnsetHopSize = 512;

/// Half-wave-rectified spectral flux, one value per STFT hop, fed mono PCM in
/// chunks of any size. Holds one FFT frame of audio. Offline, app thread.
class OnsetEnvelope {
 public:
  OnsetEnvelope();

  void Push(const float* mono, size_t count);

  /// One value per complete frame; a tail shorter than a frame is dropped.
  std::vector<float> TakeFlux();

 private:
  void AnalyzeFrame();

  std::vector<float> window_;
  std::vector<float> frame_;
  std::vector<float> fft_buf_;
  std::vector<float> mag_;
  std::vector<float> prev_mag_;
  std::vector<float> flux_;
  size_t filled_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_ONSET_ENVELOPE_H
