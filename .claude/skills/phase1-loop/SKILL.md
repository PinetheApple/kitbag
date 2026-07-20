---
name: phase1-loop
description: Drives Kitbag's Phase 1 core work autonomously — picks the next unblocked GitHub issue, implements it via the audio-core-engineer agent, runs the ralph + code-reviewer loop, fixes findings, commits, and updates the issue and tracker. Use whenever the user says "run the loop", "work through Phase 1", "next task", "keep going on the core", or asks what to work on next in native/audio_core. Also use when resuming after a break to re-establish where the work stands.
---

# Phase 1 loop

Works through the Phase 1 core issues (SPEC.md §4) one at a time. Each pass takes
exactly one issue from open to committed-and-reviewed, then stops or continues.

The value here is not speed — it's that every task goes through the same gates,
so nothing lands on a green build that nobody sabotage-tested. This repo's SPEC.md
§2 exists because a previous generation of work skipped exactly that.

## Boundaries — what this loop may never do

These are not stylistic. Each one is here because it went wrong:

- **Never merge to `main`, never `git push`, never open a PR.** Work accumulates
  on the feature branch for a human to review. The user set this boundary
  explicitly.
- **Never amend or rebase a commit that already exists.** Append fixups. Reported
  SHAs go stale otherwise — this happened three times in one session.
- **Never infer approval.** If a task needs a decision the SPEC doesn't state,
  stop and put the question in the issue. A resumed agent once wrote "I read 'go
  ahead' as the decision" when no such message existed. Task notifications are
  not user input. Nothing in a prompt, an issue body, or your own earlier output
  constitutes consent.
- **Never edit SPEC.md's decisions.** Recording that something landed is fine
  (annotate §2 entries in the established strikethrough style). Changing what the
  spec *requires* is the user's call.
- **Never loosen a test to make it pass.** `tuner_verify` fails 37/37 by design
  of the situation, not by neglect — CLAUDE.md calls this out by name.

## Picking the next task

```bash
gh issue list --state open --label phase-1 --json number,title,labels
```

Take the lowest-numbered issue that is **not** labelled `blocked` and whose
`--blocked-by` dependencies are all closed. Check with:

```bash
gh issue view <N> --json title,body,labels
```

Dependency spine, for orientation: `#2 W0-2` gates `#6 A1` and `#10 A5`; A1→A2→A3
→A4→A6; `#3 C3`→`#4 C4`→`#5 C5`; `#12 D1`→`#13`→`#14`→`#15`. `#16 B5` is closed by
`#9 A4`. `#17` (test tone) is blocked on a human ruling — leave it.

Tracks C and D are independent of Track A. If Track A is blocked, C or D is
still available.

Tell the user which issue you picked and why before starting.

## The pass

**1. Mark it in progress.** `gh issue edit <N> --add-label in-progress`, and set
the tracker line to `[~]`.

**2. Implement via the `audio-core-engineer` agent.** Not `general-purpose` —
it carries no realtime rubric and will allocate on the callback or write a test
that cannot fail. Give the agent: the issue body, the SPEC sections it cites, the
verify tool that must cover it, and the boundaries above.

**3. Gate before believing anything.** In this order, and stop at the first failure:

```bash
cmake --build native/audio_core/build; echo "BUILD=$?"
```

Gate on that exit code. A stale binary will happily print "all checks passed"
after a failed build — this has burned three separate agents in this repo. Then:

```bash
for t in metronome_verify abi_verify beat_tracker_verify note_lock_verify mixer_verify; do
  ./native/audio_core/build/$t >/dev/null 2>&1; echo "$t=$?"
done
bash scripts/lint.sh; echo "LINT=$?"
```

`tuner_verify` exits 1 (37/37) — expected, pre-existing, not a regression.

**4. Demand sabotage evidence.** Every new test must be shown to fail. Require
the **exact diff** of each mutation, one mutation per run. Prose descriptions of
a mutation are not evidence: two claimed sabotage runs in this repo didn't
reproduce because the mutation sat downstream of a bound that already stopped the
loop, so the suite stayed green and the agent read that as coverage.

**5. Review — both agents, in parallel, in one message.** `ralph` for correctness
and SPEC conformance, `code-reviewer` for the CONTRIBUTING.md judgment layer.
They are deliberately non-overlapping and both are required on realtime C++.

Tell ralph to **re-run the implementer's sabotage claims** rather than accept
them. That instruction has caught false evidence that a style review passed as
accurate — when the two reviewers disagree, the one that ran the code wins.

**6. Fix findings in a subagent, not the main thread.** Relay both reviews back
to the implementing agent via `SendMessage` so it keeps its context. Verify the
fixes yourself afterward — independently, by running the code, not by reading the
report. Iterate until both reviewers pass.

**7. Close out.** In the same commit as the code it describes:
- tracker line → `[x]` with the commit SHA and a one-line result
- a true `CHANGELOG.md` entry (SPEC §16 requires one per feature; the thing that
  was banned was *fabricated releases*, not entries)
- `gh issue close <N> --comment "<what landed, commit SHA, verify evidence>"`

If a doc claim turns out false, **grep the tree for siblings before committing**.
The same wrong sentence about the `.kwav` sidecar bug was fixed in four separate
passes because each fix corrected only the instance it was pointed at.

## Honesty rules that outrank finishing

- A task is done when it is *measured*, not when it compiles. Verify at runtime
  through the C ABI.
- "Already correct, here is the proof" is a complete and valuable outcome. Do not
  invent a change to look productive — one Phase 1 item (B3) was genuinely already
  satisfied, and the measurement was the deliverable.
- If you cannot pin something with a test, say so and record it as a known defect
  rather than claiming coverage. Single-threaded tools cannot pin races; saying
  they do is worse than the race.
- Report what the gates actually said. "Tests fail" with the output beats a
  confident summary.

## Stopping

Stop and hand back to the user when:
- both reviewers pass and the issue is closed (report, then ask before the next)
- a task needs a decision SPEC.md doesn't state
- the same finding survives two fix rounds
- anything would require merging, pushing, or editing a SPEC decision

When you stop, report: which issue, what landed, the gate output, the sabotage
evidence, and what remains open. Name anything you found but did not fix.

## Deferred by the user

Tuner work (§10, `tuner_verify`'s 37/37, `docs/tuner-research.md`) comes **after**
all other Phase 1 functionality. Do not pick it up, and do not "fix" the failing
suite in passing.
