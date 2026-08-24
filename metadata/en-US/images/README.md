# Pending raster assets — require a real device build

These are **not generated yet** and must not be mocked up (#61 acceptance:
screenshots come from a real device build, not mockups). Once a signed build
is installed on a device, capture:

| Asset | Spec | Notes |
|---|---|---|
| `icon.png` | 512×512 | The launcher icon; `scripts/build-icons.sh` renders it — copy from a device-independent render is acceptable. |
| `featureGraphic.png` | 1024×500 | Needs a design pass; not blocked on the device. |
| `phoneScreenshots/*.png` | ≥ 2, 16:9 or 9:16 | The metronome performance surface at minimum; taken from the installed build. |

Nothing else in this tree depends on these files existing; the text metadata
and the build recipe are submittable without them (F-Droid flags missing
images at review rather than rejecting outright — QUESTION: confirm whether
that is still current practice).
