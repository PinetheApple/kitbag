---
name: Task
about: Work to be done — a feature, a milestone slice, or repo tooling
labels: enhancement
---

## Scope

What is being built, and the SPEC.md sections that govern it. For anything with a
screen, name the binding file in `design/` (§12 precedence).

## Foundation

What already exists that this builds on, and what it must not duplicate — one
definition, one owner (§13.7).

## Acceptance criteria

- [ ]
- [ ] Gates: typecheck, `lint --max-warnings 0`, vitest, prettier, `generate:check`
- [ ] Verified on a device, if it reaches a screen or the native boundary
