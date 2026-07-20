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

## The main thread dispatches; subagents execute

Every build, test run, file read, mutation and fix happens in a subagent. The main
thread picks the issue, routes the work, relays verdicts, and commits — nothing
else. Its context is the one resource a pass cannot recover once spent, and a
single verify run pasted into it costs more than the entire issue body.

Independence comes from *which* agent runs the code, not from the main thread
running it. A verifier that did not write the implementation is independent; the
main thread reading a report is not verification at all. So the gates move to a
**verifier** — a fresh agent, spawned per gate round, that has never seen the diff
and therefore has nothing to rationalise.

Ask every subagent for verdicts, not transcripts: exit codes, failing check names,
and the exact diff of a mutation. Never the passing output.

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
gh auth status
gh issue list --state open --label phase-1 --json number,title,labels
```

Confirm the active account is **PinetheApple** first. `~/Development` repos use
it; a `~/Work` account leaks in and fails the *writes* only — reads succeed, so
the first symptom is `does not have the correct permissions` half a pass later.
Fix with `gh auth switch --user PinetheApple`.

A `defect` on a shipped path outranks feature work, whatever its number — it is
already wrong in code someone can run, while an unbuilt feature is merely absent.
Otherwise take the lowest-numbered issue that is **not** labelled `blocked` and
whose `--blocked-by` dependencies are all closed. Check with:

```bash
gh issue view <N> --json title,body,labels
```

Dependency spine, for orientation only — the issue bodies are authoritative and
this list rots: `#2 W0-2` gates `#6 A1` and `#10 A5`; A1→A2→A3→A4→A6; `#3 C3`→
`#4 C4`→`#5 C5`; `#12 D1`→`#13`→`#14`→`#15`. `#16 B5` will be closed by `#9 A4`.
`#17` (test tone) is blocked on a human ruling — leave it.

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

**3. Gate in a fresh verifier.** Spawn a new `audio-core-engineer` — not the
implementer, not the main thread — whose only job is to run the gates and report
exit codes.

Give it this, and require it back verbatim:

```bash
rm -rf native/audio_core/build
cmake -S native/audio_core -B native/audio_core/build -G Ninja -DKITBAG_BUILD_TOOLS=ON
cmake --build native/audio_core/build; echo "BUILD=$?"
```

Gate on that exit code. A stale binary will happily print "all checks passed"
after a failed build — this has burned three separate agents in this repo, and an
incremental build reporting `ninja: no work to do` hides it. The clean rebuild
costs about a second; take it. Then:

```bash
for t in native/audio_core/build/*_verify; do
  n=$(basename "$t"); [ "$n" = tuner_verify ] && continue
  "$t" >/dev/null 2>&1; echo "$n=$?"
done
bash scripts/lint.sh; echo "LINT=$?"
```

The glob is deliberate — a hardcoded tool list goes stale the moment a task adds
a verify tool, and silently stops gating the newest work.

`tuner_verify` exits 1 (37/37) — expected, pre-existing, not a regression.

**4. Demand sabotage evidence.** Every new test must be shown to fail. Require
the **exact diff** of each mutation, one mutation per run. Prose descriptions of
a mutation are not evidence: two claimed sabotage runs in this repo didn't
reproduce because the mutation sat downstream of a bound that already stopped the
loop, so the suite stayed green and the agent read that as coverage.

**A mutation that stays green is a finding about the test, and it must be
reported as one.** Two outcomes, both honest, both worth more than a green suite:

- *The test can be sharpened.* `TestSeek` ran `Start(); Seek(); Stop()` back to
  back, so the producer often had not been scheduled and the stale-frame path
  never ran. A read before the seek made the mutation fail. Say what was weak and
  what fixed it.
- *The behaviour is genuinely unpinnable.* A window a few instructions wide on
  the producer thread cannot be hit from a single-threaded consumer. Ship the fix,
  and **delete the test that would have passed either way** — a vacuous check is
  worse than no check, because it reads as coverage forever after.

  Then mark the gap **in the code, at the line it protects** — not only in the
  report, which nobody reads again. A green suite behind a check-count guard reads
  as thorough coverage; the next reader who "simplifies" the invariant away sees
  97/97 and concludes it was safe. A report cannot reach that reader. One clause
  at the store can.

**5. Review — both agents, in parallel, in one message.** `ralph` for correctness
and SPEC conformance, `code-reviewer` for the CONTRIBUTING.md judgment layer.
They are deliberately non-overlapping and both are required on realtime C++.

Tell ralph to **re-run the implementer's sabotage claims** rather than accept
them. That instruction has caught false evidence that a style review passed as
accurate — when the two reviewers disagree, the one that ran the code wins.

**6. Fix in the implementer, re-gate in a verifier, re-review in both.** Relay
both reviews back to the implementing agent via `SendMessage` so it keeps its
context. Then repeat step 3 in a *new* verifier and step 5 in both reviewers —
resumed via `SendMessage`, so they judge the delta rather than re-reading the
tree. Iterate until both pass.

Relay a review by restating its findings in your own words with the evidence
attached. Never paste a full report into the next agent, and never paste one back
to the user — say what was found and what it means.

**7. Close out.** In the same commit as the code it describes:
- tracker line → `[x]` with the commit SHA and a one-line result
- a true `CHANGELOG.md` entry (SPEC §16 requires one per feature; the thing that
  was banned was *fabricated releases*, not entries)
- `gh issue close <N> --comment "<what landed, commit SHA, verify evidence>"`

**Grep the tree for siblings before committing** — a defect found once is a
pattern until proven otherwise, and this holds for code as much as prose. The
same wrong sentence about the `.kwav` sidecar bug was fixed in four separate
passes because each fix corrected only the instance it was pointed at; the
`ma_format_f32` bug in `file_audio_reader.cpp` had a live twin in `decoder.cpp`
feeding `kb_analyze_song`, which no verify tool covered.

A sibling outside the issue's scope gets **its own issue**, filed with the
evidence and the blast radius, not a silent fix bolted onto this commit.

**8. Start the next pass.** Report what landed, then go straight back to picking
the next task. The loop runs to the end of Phase 1 on its own — the user invoked
it to work through the phase, not to approve each issue. Report *while* moving,
not instead of moving.

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

A closed issue is **not** a stopping point — it is the cue to pick the next one.
Stop and hand back only when:
- a task needs a decision SPEC.md doesn't state
- the same finding survives two fix rounds
- anything would require merging, pushing, or editing a SPEC decision
- no unblocked issue is left, which is the end of Phase 1

Judgment calls that the picking rule already answers are not decisions — resolve
them and say what you resolved. Reserve the stop for questions only the user can
answer.

When you stop, report: which issue, what landed, the gate output, the sabotage
evidence, and what remains open. Name anything you found but did not fix.

## Deferred by the user

Tuner work (§10, `tuner_verify`'s 37/37, `docs/tuner-research.md`) comes **after**
all other Phase 1 functionality. Do not pick it up, and do not "fix" the failing
suite in passing.
