#ifndef KITBAG_FFT_H
#define KITBAG_FFT_H

#include <cstdint>

namespace kitbag {

int fft_log2(int n);
int fft_bit_reverse(int x, int log2n);

/// In-place radix-2 complex FFT on interleaved data
/// [real0, imag0, real1, imag1, ...]. Length n must be power of 2.
/// If inverse = false: forward FFT (unnormalized).
/// If inverse = true: inverse FFT (scaled by 1/n).
void fft(float* data, int n, bool inverse);

/// Fill arr with values of a Hann window of length n.
void fft_hann(float* arr, int n);

}  // namespace kitbag

#endif  // KITBAG_FFT_H
