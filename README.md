# context-check

[![tests](https://github.com/wallacedrew/context-check/actions/workflows/test.yml/badge.svg)](https://github.com/wallacedrew/context-check/actions/workflows/test.yml)

A statusline gauge for [Claude Code](https://code.claude.com/) that gives you a
glanceable read on context load: how full the window is, and how long the
conversation arc has grown. Zero dependencies, Node 18+.

```
Opus 4.8 ▓▓▓▓░░░░░░ 42% sharp           ← plenty of headroom
Opus 4.8 ▓▓▓▓▓▓▓░░░ 71% drift risk      ← restate constraints
Opus 4.8 ▓▓▓▓▓▓▓▓▓░ 91% compaction wall ⚠ ← /compact now
```

The colored row sits at the bottom of your prompt and updates every turn.
Green / amber / red in a real terminal.

---

## The story

**The base case is the statusline.** You wire `context-check --line` into your
Claude Code settings *once*. From then on a single colored row sits at the
bottom of your prompt and updates every turn. You don't run anything — you
just glance down. The whole value is the moment you notice the bar slide into
amber (`drift risk`) or red (`dilution` / `compaction wall`), which is your
cue to restate a hard constraint or run `/compact`.

When you want the reasoning, not just the signal, run `context-check`
directly. The multi-line gauge adds the per-zone advice line, the auto-compact
note, and the hypothesis disclaimer.

Both modes drive one decision: **keep going, restate a constraint, or compact
now.**

---

## Why not just `/context`?

Claude Code already ships two adjacent features. `/context` prints the
current token breakdown on demand, and **auto-compact** kicks in at
`auto_compact_threshold_percent` (default 80%) to truncate before the window
overruns.

What Claude doesn't ship: a passive, always-on visual gauge with zones and
drift measurement. `/context` is poll-the-data, auto-compact is the
last-second safety net — neither tells you mid-conversation that you're
sliding from `sharp` into `drift risk`. That's the gap context-check fills.

---

## Install

```bash
npm install -g github:wallacedrew/context-check
context-check install
```

Two lines. The first puts `context-check` on your `PATH` (requires Node 18+).
The second writes the statusline block into `~/.claude/settings.json` (saving a
`.bak` of whatever was there). Reload Claude Code and the gauge appears.

Pin a specific version with `#v1.1.0` (or any tag/branch/SHA) on the install
URL:

```bash
npm install -g github:wallacedrew/context-check#v1.1.0
```

If `context-check install` finds a different `statusLine` already configured,
it refuses and points you at `--force`. If you'd rather configure by hand,
drop this block into `~/.claude/settings.json` yourself:

```json
{
  "statusLine": {
    "type": "command",
    "command": "context-check --line"
  }
}
```

## Uninstall

```bash
context-check uninstall
npm uninstall -g context-check
```

The first command removes the `statusLine` block from `~/.claude/settings.json`
(saving the original to `.bak` first). It refuses to remove a different
statusLine without `--force`, in case you've replaced ours with your own. The
second removes the binary. Run the subcommand *before* the npm uninstall —
once the binary's gone, the subcommand goes with it.

## Recipe: show the project name alongside the gauge

The base statusline shows only the model and the gauge. If you also want the
current project folder name on the same row, point `statusLine.command` at a
tiny wrapper script.

Create `~/.claude/bin/statusline.sh`:

```bash
#!/usr/bin/env bash
input=$(cat)
dir=$(printf '%s' "$input" | node -e '
let buf = "";
process.stdin.on("data", c => buf += c);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(buf);
    const d = (j && j.workspace && j.workspace.current_dir) || "";
    if (d) process.stdout.write(require("path").basename(d));
  } catch {}
});
' 2>/dev/null)
gauge=$(printf '%s' "$input" | context-check --line 2>/dev/null)
if [ -n "$dir" ] && [ -n "$gauge" ]; then
  printf '%s | %s\n' "$dir" "$gauge"
elif [ -n "$gauge" ]; then
  printf '%s\n' "$gauge"
elif [ -n "$dir" ]; then
  printf '%s\n' "$dir"
fi
```

`chmod +x ~/.claude/bin/statusline.sh`, then in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/bin/statusline.sh"
  }
}
```

You'll see `my-project | Opus 4.8 ▓▓▓▓░░░░░░ 42% sharp`.

## On-demand check

```bash
# See sample output without piping anything
context-check --demo

# Or pipe a session JSON object (this is what Claude Code does for you)
echo '{"model":{"display_name":"Opus 4.8"},"context_window":{"used_percentage":62}}' \
  | context-check
```

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

## Zones

| Zone | Condition | What to do |
|---|---|---|
| `crisp` (green) | strain < 0.22 | nothing |
| `sharp` (green) | strain ≥ 0.22 | nothing — recent context dominant |
| `drift risk` (amber) | strain ≥ 0.42 | restate hard constraints |
| `dilution` (red) | strain ≥ 0.62 | consider `/compact` soon |
| `compaction wall` (red) | fill ≥ 88% | `/compact` now |
| `blind` (dim) | no usage data yet | wait for next API call |

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

## Hard guarantees

- **Never crashes in statusline mode.** All failure paths degrade to a single
  readable line and exit 0.
- **Never hangs.** stdin read times out at 200ms.
- **Respects `NO_COLOR`.** Set the env var to disable ANSI escape codes.

---

## FAQ

**Does it phone home?**
No. Pure stdin processing — read JSON, render to stdout, exit. No network
calls anywhere in the source. The tarball is `src/*.js` (~10 files, ~10 kB
total) plus README and LICENSE; the whole tool is readable in a few minutes.

**Does `/resume` work?**
Yes. Turn depth is counted by tailing `transcript_path` from the session
JSON, so resuming an old session just hands the gauge a longer transcript
to count from.

**Does it work on Bedrock (or any provider without `used_percentage`)?**
Partially. When `context_window.used_percentage` isn't populated the gauge
falls through to `current_usage.*_input_tokens` if those are present.
If neither is available the row shows `--% blind` and the zone is `blind`
— this is documented in *Known blind spots* above, not a crash. v2 plans
a transcript-parsing fill fallback for these environments.

---

## Roadmap

- **v1** (this build) — CLI + statusline gauge with live turn counting.
- v2 — transcript-parsing fill fallback for Bedrock users (no `/context`).
- v3 — interactive two-axis map UI fed by real session data.

(Explicitly out of scope: a skill that asks the model to self-report its
own coordinates. A degrading system is the least reliable narrator of its
own degradation. Measurement stays external.)
