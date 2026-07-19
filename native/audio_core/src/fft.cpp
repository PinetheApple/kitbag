#include "fft.h"

#include <cmath>
#include <numbers>

namespace kitbag {

int fft_log2(int n) {
  int k = 0;
  while ((1 << k) < n) ++k;
  return k;
}

int fft_bit_reverse(int x, int log2n) {
  int y = 0;
  for (int i = 0; i < log2n; ++i) {
    y = (y << 1) | (x & 1);
    x >>= 1;
  }
  return y;
}

namespace {

void fft_permute(float* data, int n, int log2n) {
  for (int i = 0; i < n; ++i) {
    const int j = fft_bit_reverse(i, log2n);
    if (j > i) {
      std::swap(data[2 * i], data[2 * j]);
      std::swap(data[2 * i + 1], data[2 * j + 1]);
    }
  }
}

// One Cooley-Tukey DIT pass over blocks of [len] samples.
void fft_stage(float* data, int n, int len, bool inverse) {
  const float twr = std::cos(2.0f * std::numbers::pi_v<float> / len);
  const float twi = (inverse ? 1.0f : -1.0f) *
                    std::sin(2.0f * std::numbers::pi_v<float> / len);

  for (int i = 0; i < n; i += len) {
    float wr = 1.0f, wi = 0.0f;
    for (int j = 0; j < len / 2; ++j) {
      const int lo = 2 * (i + j);
      const int hi = 2 * (i + j + len / 2);
      const float tr = wr * data[hi] - wi * data[hi + 1];
      const float ti = wr * data[hi + 1] + wi * data[hi];
      data[hi] = data[lo] - tr;
      data[hi + 1] = data[lo + 1] - ti;
      data[lo] += tr;
      data[lo + 1] += ti;
      const float nwr = wr * twr - wi * twi;
      wi = wr * twi + wi * twr;
      wr = nwr;
    }
  }
}

}  // namespace

void fft(float* data, int n, bool inverse) {
  fft_permute(data, n, fft_log2(n));

  for (int len = 2; len <= n; len *= 2) {
    fft_stage(data, n, len, inverse);
  }

  if (!inverse) return;
  for (int i = 0; i < 2 * n; ++i) {
    data[i] /= static_cast<float>(n);
  }
}

void fft_hann(float* arr, int n) {
  for (int i = 0; i < n; ++i) {
    arr[i] = 0.5f *
             (1.0f - std::cos(2.0f * std::numbers::pi_v<float> * i / (n - 1)));
  }
}

}  // namespace kitbag
