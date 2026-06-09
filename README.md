# context-check

A statusline gauge for [Claude Code](https://code.claude.com/) that gives you a
glanceable read on context load: how full the window is, and how long the
conversation arc has grown. Zero dependencies, Node 18+.

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

## Install

```bash
npm install -g context-check
```

That puts `context-check` on your `PATH`. Requires Node 18+.

Want the latest unreleased main branch (or your own fork)?

```bash
npm install -g github:wallacedrew/context-check
```

## Statusline setup (the base case — do this once)

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "context-check --line"
  }
}
```

Reload Claude Code. Done.

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

## Roadmap

- **v1** (this build) — CLI + statusline gauge with live turn counting.
- v2 — transcript-parsing fill fallback for Bedrock users (no `/context`).
- v3 — interactive two-axis map UI fed by real session data.

(Explicitly out of scope: a skill that asks the model to self-report its
own coordinates. A degrading system is the least reliable narrator of its
own degradation. Measurement stays external.)
