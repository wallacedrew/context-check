# BUILD SPEC: `context-check`

> Hand this file to Claude Code. Build the tool described below. Read the
> "Ground truth" and "Hard constraints" sections before writing any code —
> they contain facts that override your training-data priors about how Claude
> Code's statusline works. When something here conflicts with what you
> remember, trust this doc and verify against the live docs at
> https://code.claude.com/docs/en/statusline.

---

## What this is

A CLI + statusline tool for Claude Code that gives a glanceable read on
context load: how full the context window is, plus a rough drift estimate,
rendered as a colored terminal gauge. Node.js, zero runtime dependencies
(use built-in `fs` and JSON parsing — do NOT add `jq` as a dependency or
require it; parse JSON in-process).

ref: https://claude.ai/chat/04b1700d-d94f-4225-87ec-16d54a09f1a8

## Why it exists (don't skip — it drives the design)

Context load is two independent failure modes, not one:

- **dilution** — high token fill; real instructions compete with bulk content
  and specifics get flattened.
- **drift** — long conversation arc; earliest instructions decay regardless of
  fill because they're far back.

A single "% full" bar conflates them. You can be 30% full but 60 turns deep
(drift) or 85% full at turn 3 (dilution). So the tool reads **two axes**:
fill (measured) and turn depth (a proxy from the transcript).

Critical framing the tool must preserve in its output: **it measures budget,
not cognition.** It cannot observe a model actually degrading. The "zone"
label is a hypothesis layered on measured fill. Any coefficient used to blend
the axes is a guess and must be labeled as such in the output. Do not let the
tool imply it has measured behavioral quality.

---

## Base usage case (the story the build must serve)

There are two ways to invoke this, and they are NOT equal. The build should
optimize for the first and treat the second as the fallback.

**Primary (always-on statusline) — this is the base case.**
The user wires `context-check --line` into `~/.claude/settings.json` once, and
from then on it's passive: a single colored row sits at the bottom of the
Claude Code prompt, updating every turn. The user does nothing — they glance
down mid-session. The whole value is the moment they notice the bar slide into
amber ("drift risk") or red, which is their cue to restate a constraint or run
`/compact`. Optimize line-mode for this: it must be terminal-narrow, never
wrap, never break the prompt, and read at a glance without parsing numbers.

  Setup the user does once:
  ```json
  { "statusLine": { "type": "command", "command": "context-check --line" } }
  ```
  After that, the interaction is: *look down → see zone → act or ignore.*

**Secondary (on-demand full gauge).**
When the user wants the reasoning, not just the signal, they run
`context-check` directly to get the multi-line gauge with the advice line and
the hypothesis disclaimer. In normal Claude Code use this requires piping the
session JSON; for a quick check without a live session, `--demo` shows sample
output. This mode answers "why is it telling me that?" — the statusline
answers "is anything wrong right now?"

**What the user is actually deciding.** Both modes exist to drive ONE decision:
*keep going, restate a constraint, or compact now.* Every output should make
that decision obvious. If a user has to think about what a number means, the
output failed. The zone label + advice line carry the decision; the bar and %
are supporting detail.

The README must open with this story — the statusline setup first, the
on-demand command second — not with a flag reference.

---

## Ground truth (verified facts — do not "fix" these)

1. Claude Code pipes a JSON object to the statusline `command` via **stdin**
   on every update.
2. The fill signal lives at `context_window.used_percentage` (a number) and/or
   a `current_usage` token object. `used_percentage` is **input-only** by
   contract.
3. `current_usage` / `used_percentage` is **null before the first API call**
   in a session, and **again immediately after `/compact`** until the next API
   call repopulates it. This is expected, not an error.
4. The JSON also contains: `model.display_name`, `model.id`, `session_id`,
   `transcript_path`, `workspace.current_dir`, `cost.*`, and
   `context_window.context_window_size`. An
   `auto_compact_threshold_percent` may be present (default to 80 if absent).
5. Parsing the transcript at `transcript_path` to estimate tokens is **lossy**:
   it misses MCP tool definitions (~30–50k tokens) and CLAUDE.md, so it can
   read low by a wide margin. Use it only as a fallback for fill, and as the
   source for turn depth.
6. There is an open bug where statusline `context_window` data has at times
   carried cumulative session tokens instead of current-window usage. The tool
   should prefer `used_percentage` and not crash on absurd values (clamp to
   0–100).

---

## Data resolution order

**Fill %** — first available wins:
1. `context_window.used_percentage` → round, clamp 0–100. source tag: `used_percentage`
2. `current_usage` object → sum `input_tokens + cache_read_input_tokens +
   cache_creation_input_tokens`, divide by `context_window_size` (or
   `current_usage.max_tokens`, else 200000). source tag: `current_usage`
3. neither present → **blind state**: render `--%`, zone `blind`, do not guess.

**Turn depth** — from `transcript_path`:
- If path exists, read the JSONL and count **user + assistant message records**,
  NOT raw line count. Tool-call records inflate raw lines and make agentic
  sessions look artificially deep — exclude them. If you can't cleanly
  distinguish record types, count records whose role is `user` or `assistant`.
- If no path / unreadable → turns = unknown, render `~?`.

---

## Zone model

```
strain = (fill/100) * 0.7 + depth * 0.3      // depth = min(1, turns/80)
```

- `fill >= 88`            → **compaction wall** (red)
- `strain >= 0.62`        → **dilution** (amber/red)
- `strain >= 0.42`        → **drift risk** (amber)
- `strain >= 0.22`        → **sharp** (green)
- else                    → **crisp** (green)
- fill is null            → **blind** (dim/gray)

The `0.7 / 0.3` split is a HYPOTHESIS, not calibrated. Surface this in the
full-gauge output (a dim line: "drift est. uses 0.7·fill + 0.3·depth — a
hypothesis, not measured."). Keep the coefficients as named constants so they
are trivially swappable.

Per-zone one-line advice:
- crisp: "fresh. full headroom. nothing to do."
- sharp: "comfortable. recent context dominant. good adherence."
- drift risk: "long arc — earliest instructions decaying. restate hard constraints."
- dilution: "high fill. specifics get flattened. consider /compact soon."
- compaction wall: "near limit. truncation imminent. /compact now."
- blind: "no usage yet (pre-first-call or just compacted). gauge resumes next turn."

---

## Output modes

**Full gauge** (default, `context-check`): multi-line. model name header, a
20-char fill bar (`▓` filled / `░` empty, ANSI-colored by zone), the fill %
with its source tag in dim, the turn depth, the zone label colored, the advice
line, an auto-compact note if fill >= threshold, and the hypothesis disclaimer.

**Line mode** (`--line`): single row for the statusline —
`{model} {10-char bar} {fill%} {zone label}` + a ` ⚠` when fill >= threshold.

**Demo** (`--demo`): render a canned 62% sample so the user can see output
without piping anything.

**No stdin + TTY**: print a short usage hint (how to pipe JSON, and `--demo`).
**Invalid JSON on stdin**: print one graceful line, exit 0 (never throw —
this runs in a statusline and must never break the prompt).

Use raw ANSI escape codes for color (codes 31/32/33/90 and dim `2`). No color
libraries. Respect a `NO_COLOR` env var if set (skip ANSI).

---

## Packaging

- `package.json` with a `bin` entry `context-check` → `src/context-check.js`,
  `"engines": { "node": ">=18" }`, no dependencies.
- Shebang `#!/usr/bin/env node`, `chmod +x`.
- A `README.md` covering: what it measures, what it does NOT measure (budget
  not cognition), install (`npm install -g .`), statusline setup (the
  `~/.claude/settings.json` snippet using `context-check --line`), the data
  contract, and the known blind spots from "Ground truth" #3/#5/#6.

`~/.claude/settings.json` statusline snippet to document:
```json
{ "statusLine": { "type": "command", "command": "context-check --line" } }
```

---

## Hard constraints

- **Never crash in statusline mode.** Wrap stdin parse and transcript read in
  try/catch. Any failure → degrade to a readable fallback string, exit 0.
- **Don't hang.** stdin read must have a short timeout (~200ms) so it returns
  even if nothing pipes.
- **Round every displayed number.** No float artifacts.
- **Don't invent a turn count** when the transcript is unavailable — show `~?`.
- **Don't claim to measure model quality.** Zone = hypothesis, labeled.
- Zero npm dependencies.

---

## Acceptance tests (the build must pass all)

Run each and eyeball the result:

```bash
# 1. demo renders a 62% drift-risk gauge
context-check --demo

# 2. healthy
echo '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":28}}' | context-check
# expect: green, "crisp"

# 3. wall + warning
echo '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":91}}' | context-check
# expect: red, "compaction wall", auto-compact note

# 4. blind state (null usage, post-compact)
echo '{"model":{"display_name":"Opus 4.8"},"context_window":{}}' | context-check
# expect: "--%", zone "blind", no crash

# 5. line mode
echo '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":83}}' | context-check --line
# expect: single row, "drift risk", ⚠

# 6. garbage input
echo 'not json' | context-check
# expect: one graceful line, exit 0

# 7. current_usage fallback (no used_percentage)
echo '{"context_window":{"context_window_size":200000},"current_usage":{"input_tokens":100000,"cache_read_input_tokens":20000}}' | context-check
# expect: ~60%, source tag "current_usage"

# 8. absurd value from the known bug — must clamp, not break
echo '{"context_window":{"used_percentage":340}}' | context-check
# expect: clamps to 100%, does not throw
```

---

## Roadmap (build v1 only; note these as stubs/comments)

- v1 — CLI + statusline gauge with live turn counting from `transcript_path` *(this build)*
- v2 — transcript-parsing fill fallback for Bedrock users (no `/context`)
- v3 — interactive two-axis map UI fed by real session data
- (explicitly out of scope) a skill that asks the model to self-report its own
  coordinates — rejected by design: a degrading system is the least reliable
  narrator of its own degradation. Measurement stays external.
