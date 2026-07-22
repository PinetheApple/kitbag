# Vendored: QM-DSP downbeat + beat tracking core

Minimal source subset of the [QM-DSP library](https://github.com/c4dm/qm-dsp)
from the Centre for Digital Music, Queen Mary University of London — exactly the
compile closure of `DownBeat` + `TempoTrackV2` (bar/beat and downbeat
estimation), nothing more. Vendored for Kitbag song analysis (SPEC.md §4.3/§4.6,
D1 / issue #12).

- Upstream: https://github.com/c4dm/qm-dsp @ `e34a3cc188332ed7c33cd9257ef164de5b587191`
- Vendored: 2026-07-22
- License: **GPL-2.0-or-later** (see `LICENSE`, copied verbatim from upstream
  `COPYING`). Bundled kissfft (`ext/kissfft/`) is 3-clause BSD (see
  `ext/kissfft/COPYING`).

## GPL propagation — read this

QM-DSP is GPL-2.0-or-later. Linking it into `kitbag_core` makes the resulting
binary a GPL work. This is a deliberate, user-ruled decision (`docs/decisions.md`,
"2026-07-21 · D1 downbeat tracker") — recorded here so it is not a silent surprise.

## Subset taken

Upstream repo paths are preserved so the upstream diff stays clean; files are
**unmodified** and keep their copyright banners.

- `dsp/tempotracking/` — `DownBeat.{h,cpp}`, `TempoTrackV2.{h,cpp}`
- `dsp/rateconversion/` — `Decimator.{h,cpp}`
- `dsp/transforms/` — `FFT.{h,cpp}`
- `maths/` — `MathAliases.h`, `MathUtilities.{h,cpp}`, `KLDivergence.{h,cpp}`, `nan-inf.h`
- `ext/kissfft/` — `kiss_fft.{h,c}`, `_kiss_fft_guts.h`, `tools/kiss_fftr.{h,c}`

`BarBeatTrack` itself is a Vamp-plugin wrapper in the separate qm-vamp-plugins
repo; in qm-dsp the equivalent primitives are `TempoTrackV2` (beat tracking) and
`DownBeat` (downbeat estimation), which is what is vendored here.

The onset **detection function** (complex spectral difference) that feeds
`TempoTrackV2::calculateBeatPeriod` also lives in qm-vamp-plugins, NOT in qm-dsp
— so it is correctly absent here. D2 must supply a detection-function signal from
Kitbag's own analyze pipeline; `TempoTrackV2` produces no output until fed one.
Do not hunt for a detection-function class inside this vendored tree.

## Build notes

kissfft is compiled with `-Dkiss_fft_scalar=double` (QM-DSP's `FFT.cpp:121`
casts `double` buffers straight into `kiss_fft_cpx`). With the kissfft default
`float` scalar the struct layout mismatches the buffer: a pointer-type mismatch
that corrupts the FFT data, not mere precision loss. Include roots: this
directory, plus `ext/kissfft` and `ext/kissfft/tools`. See
`native/audio_core/CMakeLists.txt` (`qm_dsp` target).

Not yet called from any Kitbag translation unit — analyze wiring is D2. To
update, re-copy the closure from upstream and bump the commit hash above.
