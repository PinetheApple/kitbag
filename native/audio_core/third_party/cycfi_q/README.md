# Vendored: cycfi/q pitch-detection core

Header-only subset of the [cycfi/q](https://github.com/cycfi/q) audio DSP
library — exactly the include closure of `q/pitch/pitch_detector.hpp`
(bitstream-autocorrelation pitch detection), nothing more. Used by the
Kitbag tuner (`src/pitch_analyzer.*`).

- Upstream: https://github.com/cycfi/q @ `874f749c0a887bad5e460a6c1eaf138b4f53560e`
- `include/infra/` from https://github.com/cycfi/infra @ `2dff97a4b107eced78e426152f5001a2331cb1cf`
  (a q dependency; only `support.hpp` and `assert.hpp` are needed)
- License: Boost Software License 1.0 (see `LICENSE`; GPLv3-compatible).
  Every header keeps its upstream copyright banner.
- Files are unmodified. To update, re-copy the closure from upstream and
  bump the commit hashes above.
- Requires C++20 (upstream uses concepts).
