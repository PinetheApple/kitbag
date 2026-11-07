# Vendored: Signalsmith Stretch

Time-stretch and pitch shift for SPEC.md §7.6, wrapped by
`src/stretch/time_stretch.h`.

- Upstream: https://github.com/Signalsmith-Audio/signalsmith-stretch
- Tag: `1.4.0`, commit `a670068d9aeb64913331d5cc29337b19a457a7df`
- Vendored: 2026-11-01
- Licence: **MIT** (see `LICENSE.txt`, copied verbatim from upstream)

## Files taken

- `signalsmith-stretch.h`, unmodified, from the repository root.

Upstream's `include/signalsmith-stretch/signalsmith-stretch.h` is a one-line
forwarder to the root header and is not taken. The header still reports
`version = {1, 3, 2}` at tag 1.4.0; the tag and commit above are the pin.

## Build notes

Header-only. It needs signalsmith-linear (`../linear/`), which upstream's own
CMakeLists fetches over the network; that CMakeLists is not vendored, and
`native/audio_core/CMakeLists.txt` defines the `signalsmith_stretch` interface
target with both roots as SYSTEM include directories instead.

To update, copy the root header from the new tag, bump the tag and commit
above, and check the linear version upstream's CMakeLists asks for.
