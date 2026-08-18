Closes #

## What changed

## Acceptance criteria

Copy the criteria from the issue and tick only the ones this PR actually
satisfies. Leave the rest unticked rather than deleting them.

- [ ]

## Verification

What you ran and what it printed. Say plainly what still needs a device — a green
headless gate does not prove the JNI/TurboModule chain is intact.

- [ ] `pnpm -w typecheck` · `pnpm -w lint` · `pnpm -w test` · `pnpm -w format` · `pnpm -w generate:check`
- [ ] `bash scripts/lint.sh` (native changes) · `./native/audio_core/build/metronome_verify`
- [ ] On device:
