---
name: implement-task
description: Use when asked to implement a specific card from the CeView frontend UI/UX overhaul plan, referenced by a module+card shorthand like "m1c1" or "m0c2" — the CeView frontend rebuild's per-card build plan under docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/.
---

# Implement Task

## Overview

Turns a `m<module>c<card>` token into an approved implementation plan, then builds exactly the new
files that one CARD calls for — nothing else. The plan directory is the only source of truth; never
improvise from the prototype HTML or your own judgment about what a card "should" include.

**Plan directory (fixed):** `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`

## Token → Card

`m<N>c<M>` means: open module file `N`, take the `M`th `### CARD —` heading in that file, in file
order, 1-indexed.

| Token prefix | File |
|---|---|
| `m0` | `01-foundation.md` |
| `m1` | `02-module-1.md` |
| `m2` | `03-module-2.md` |
| `m3` | `04-module-3.md` |
| `m4` | `05-module-4.md` |

Find card `M`: `grep -n "^### CARD —" <file>` and take the `M`th match. This is a **positional**
convention local to the file — it does not match `00-index.md`'s global card numbers (module-1's
first card is global Card 4, but it's still `m1c1`). If the token doesn't resolve to a real card
(file has fewer than `M` cards, or `N` isn't 0-4), stop and ask the user — do not guess a nearby
card.

## Workflow

1. **Locate the card.** Resolve the token per the table above. Read the full `### CARD —` block up
   to (not including) the next `### CARD —` heading or end of file.

2. **Read the card's own linked sources of truth** — not summaries, the files themselves:
   - The **Flow** link (`diagrams/cards/<module>/<slug>.mmd`) — the card's control-flow diagram.
   - The **Steps (pseudocode)** link (`pseudocode/<module>/<slug>.ts`) — typed-outline pseudocode.
   - Any file under **Related files** the card says you must stay consistent with.

   These three — card text, flowchart, pseudocode — are authoritative. If the card's prose and its
   pseudocode disagree, the pseudocode wins for behavior/shape; flag the discrepancy in your plan
   rather than silently picking one.

3. **Check `Depends on:`.** For each named dependency card, find its own "Project files to
   add/implement" list and check whether those files exist AND are not placeholder stubs (a stub
   contains marker text like "Not implemented yet — see CARD" or a `TODO:` block instead of real
   logic). If any dependency is missing or still a stub, **stop here** — do not enter plan mode. Post
   a copy-pasteable blocked-status comment for the user to hand to co-developers, formatted as:

   ````markdown
   ## 🚧 `<token>` blocked — unmet prerequisite

   **Card:** `<card name>`
   **Blocked on:** `<dependency card name>` (`<its token if known>`)
   **Evidence:** `<dependency's file path>` still contains its placeholder stub, not a real
   implementation.

   This card can't be implemented until its dependency lands. Flagging here rather than proceeding
   against unbuilt foundations.
   ````

   Then stop — no plan, no implementation.

4. **Enter Plan Mode and write the plan.** Check whether `EnterPlanMode`/`ExitPlanMode` tools are
   available to you (`ToolSearch` for `select:EnterPlanMode,ExitPlanMode` if unsure). If they are,
   use them for real — call `EnterPlanMode`, then `ExitPlanMode` to submit the plan for approval.
   If they are not available (e.g. you're a dispatched subagent without session-level tools), that
   is not license to skip approval: write the same plan as a message to whoever dispatched you,
   end it with an explicit approval question ("Approve this plan before I implement?"), and wait for
   an explicit yes — silence, or your own next turn, is not approval. Either path, the discipline is
   identical: a full written plan, submitted, with unambiguous approval before any Write/Edit — not
   an informal "let me ask a couple of quick questions" substitute, even when the card looks small or
   fully specced already. The plan lists, verbatim from the card:
   - Every file in the card's **Project files to add/implement** list, and whether it's a brand-new
     file or an existing placeholder stub whose body you're replacing (stubs the card itself owns —
     see Scope below — are fair game; nothing else is).
   - Any test file the card's **Definition of Done** names, written test-first if it names specific
     behavior to cover.
   - Anything the milestone requires that the card's own file list does **not** mention (e.g. a
     route needs wiring in a shared file like `App.tsx` to actually reach the new screen) — name
     this explicitly as a **flagged gap**, not as a planned change. See Scope below: you do not
     touch it regardless of approval.
   - The exact verification command(s) — but first confirm they'd actually work: check
     `vite.config.ts`'s test include/exclude patterns pick up any new test file's path before
     trusting the card's own `Verification` block blindly.

5. **Wait for approval** (the `ExitPlanMode` response, or the explicit yes from step 4's fallback).
   Do not create or edit any file before approval.

6. **Automode.** Once approved, implement directly end-to-end in this same session — no further
   check-ins, no re-confirming steps already in the approved plan. Write tests first for anything
   the plan called out as test-first, then the implementation, then run the verification command(s)
   and report real output. The only things that stop you mid-automode are the Don'ts below or a
   genuine blocker the plan didn't anticipate (in which case stop and ask, same as any task).

7. **Report.** What you built, test output, and — unchanged from the plan — every flagged gap you
   did *not* touch, so the user knows what still needs a human (or a different card) to close it.

## Scope: only the card's own new files

**Never edit a file that isn't either (a) explicitly listed in this card's "Project files to
add/implement," or (b) an existing placeholder stub whose own header/JSDoc names this exact card as
its owner.** A file another card owns, a shared file like `App.tsx`/`layout/nav.ts`, or anything not
named by this card is out of scope — always, even when the milestone is unreachable without it, even
after plan approval. Name it as a flagged gap (step 4) instead of touching it. This is not a
judgment call to make per-task — it's the same answer every time.

## Don'ts

- **No git mutations.** `git status`/`diff`/`log`/`show` are fine for orientation. Never
  `add`/`commit`/`push`/`checkout`/`restore`/`clean`/`reset` — this repo's own CLAUDE.md forbids
  commits outright, and this skill goes further: no mutating git command at all.
- **No changes to existing code** beyond the two exceptions in Scope above. This includes files that
  "obviously" need a one-line change to make the milestone reachable.
- **No skipping Plan Mode** because the task is small or the card is fully specced. Formal approval
  happens every time, not just when the task feels ambiguous.

## Red flags — stop and reconsider

| Thought | Reality |
|---|---|
| "This card is tiny/obvious, I'll skip formal plan mode" | Every card gets a real plan + approval. Size isn't the trigger, the workflow is. |
| "The router/shared file obviously needs this one-line change" | Name it as a flagged gap. Touching it is scope creep into a file no card claims. |
| "The dependency is *basically* done, close enough" | Check for the stub marker text. Partial isn't done. Stop and post the blocked comment. |
| "I'll just ask the user a quick question instead of full plan mode" | A quick question is not plan approval. Use the real workflow. |
| "The card's Verification command is obviously right" | Check `vite.config.ts`'s test patterns actually cover the new file before trusting it. |
| "No `EnterPlanMode` tool here, so I'll skip straight to implementing" | No tool ≠ no approval step. Write the plan as a message and get an explicit yes first. |
