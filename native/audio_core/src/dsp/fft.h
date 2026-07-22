#ifndef KITBAG_DSP_FFT_H
#define KITBAG_DSP_FFT_H

#include <cstdint>

namespace kitbag {

int fft_log2(int n);
int fft_bit_reverse(int x, int log2n);

/// In-place radix-2 complex FFT over interleaved [re0, im0, re1, im1, ...];
/// n must be a power of 2. Forward is unnormalized, inverse is scaled by 1/n.
void fft(float* data, int n, bool inverse);

/// Fill arr with values of a Hann window of length n.
void fft_hann(float* arr, int n);

}  // namespace kitbag

#endif  // KITBAG_DSP_FFT_H
