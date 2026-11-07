# Vendored: signalsmith-linear

The FFT and STFT that Signalsmith Stretch (`../stretch/`) is built on.

- Upstream: https://github.com/Signalsmith-Audio/linear
- Tag: `0.6.4`, commit `de55e6a50ffcf6f8f43f649692d94691c7025151`
- Vendored: 2026-11-01
- Licence: **MIT** (see `LICENSE.txt`, copied verbatim from upstream)

## Files taken

- `signalsmith-linear/stft.h` and `signalsmith-linear/fft.h`, unmodified, from
  the repository root. They are the whole include closure of the stretch
  header.

They sit under `signalsmith-linear/` so the stretch header's
`#include "signalsmith-linear/stft.h"` resolves with this directory as the
include root. Upstream's `include/signalsmith-linear/*.h` are one-line
forwarders to the root files and are not taken.

## Build notes

No `SIGNALSMITH_USE_*` macro is defined, so `fft.h` uses its portable C++ FFT
and none of upstream's `platform/` backends (Accelerate, IPP, PFFFT, xsimd,
CMSIS-DSP) is needed or vendored.

To update, copy `stft.h` and `fft.h` from the new tag's root, check their
include closure still ends there, and bump the tag and commit above.
