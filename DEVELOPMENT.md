# DEVELOPMENT

Internal notes for `context-check` — the data contract, edge cases,
architecture, and contributor workflow. End-user docs live in
[README.md](README.md).

---

## Source layout

| File | Role |
|---|---|
| `src/context-check.js` | Bin entrypoint. Loads `cli.js` and dispatches. |
| `src/cli.js` | Top-level dispatch — `install`, `uninstall`, or default render. |
| `src/install.js` | `context-check install` — writes the `statusLine` block into `~/.claude/settings.json`. |
| `src/uninstall.js` | `context-check uninstall` — removes the `statusLine` block, backs up. |
| `src/settings.js` | Shared settings helpers (path resolution, load + parse, statusLine detection). |
| `src/session-state.js` | Parses the Claude session JSON into a renderable state. |
| `src/fill-percent.js`, `src/fill-source.js`, `src/resolve-fill.js` | Fill measurement and provenance — which JSON field gave us the percentage. |
| `src/turns.js`, `src/transcript.js` | Turn-depth counting from the transcript file. |
| `src/strain.js`, `src/zones.js` | Strain formula and zone classification. |
| `src/predicates.js` | Shared predicate helpers. |
| `src/ansi.js` | ANSI color/format helpers. Respects `NO_COLOR`. |

---

## What it measures

Two independent failure modes, not one:

- **dilution** — high token fill; real instructions compete with bulk content
  and specifics get flattened.
- **drift** — long conversation arc; earliest instructions decay regardless of
  fill because they are far back.

A single "% full" bar conflates them. You can be 30% full but 60 turns deep
(drift), or 85% full at turn 3 (dilution). `context-check` reads both axes:
fill (measured from the session JSON) and turn depth (counted from the
transcript file).

## What it does NOT measure

**This tool measures budget, not cognition.** It cannot observe a model
actually degrading. The zone label is a hypothesis layered on measured fill —
specifically:

```
strain = (fill / 100) * 0.7 + min(1, turns / 80) * 0.3
```

The `0.7 / 0.3` split is a guess. It is labeled as such in the full-gauge
output. Don't treat the zone label as a measurement of model quality; treat it
as a yellow/red flag on the resource budget.

---

## Data contract

Claude Code pipes a JSON object to the statusline command via **stdin** on
every update. `context-check` reads:

| Field | Used for |
|---|---|
| `context_window.used_percentage` | Primary fill signal (preferred) |
| `current_usage.{input,cache_read,cache_creation}_input_tokens` | Fallback fill |
| `context_window.context_window_size` | Token-to-percent conversion |
| `context_window.auto_compact_threshold_percent` | When to flag ⚠ (default 80) |
| `transcript_path` | Turn count (user + assistant records) |
| `model.display_name` | Header label |

For the authoritative schema, see
<https://code.claude.com/docs/en/statusline>.

## Known blind spots

- **Pre-first-call & just-compacted sessions are blind.**
  `used_percentage` / `current_usage` is `null` before the first API call,
  and again immediately after `/compact` until the next call repopulates it.
  The gauge will show `--%` and zone `blind`. This is expected, not a bug —
  the data simply does not exist yet.
- **Transcript-based fill (v2) is lossy.** When `used_percentage` is
  unavailable on platforms like Bedrock, falling back to transcript parsing
  misses MCP tool definitions (~30–50k tokens) and CLAUDE.md content. So it
  reads low. v1 does not attempt this; it goes `blind` instead.
- **An open Claude Code bug** has occasionally caused
  `context_window.used_percentage` to carry cumulative session tokens rather
  than current-window usage, producing absurd values (e.g. 340%). The tool
  clamps to 0–100 and does not crash.

---

## Running tests

```bash
npm test
```

Runs all specs under `test/*.test.js` against the bin via `node --test`.
Tests that need a `settings.json` target write to a fresh tmp directory per
case, so there's no shared state. Full suite is ~250 ms locally.

CI runs the same command on Node 18, 20, and 22
(`.github/workflows/test.yml`). The matrix exists because Node 22 changed
how `node --test <dir>` resolves positional arguments; we use a glob
(`test/*.test.js`) to stay portable.

## Releasing

There is no automated release workflow (deliberate — we don't publish to
npm). The release process is three commands:

```bash
git tag v1.X.Y
git push origin v1.X.Y
gh release create v1.X.Y --title "v1.X.Y — short headline" --notes "..."
```

Update the pin example in `README.md` (under *Install*) to the new tag in
the same commit as the version bump.

---

## Roadmap

- **v1** (current) — CLI + statusline gauge with live turn counting; `install`
  / `uninstall` subcommands.
- v2 — transcript-parsing fill fallback for Bedrock users (no `used_percentage`).
- v3 — interactive two-axis map UI fed by real session data.

(Explicitly out of scope: a skill that asks the model to self-report its
own coordinates. A degrading system is the least reliable narrator of its
own degradation. Measurement stays external.)
