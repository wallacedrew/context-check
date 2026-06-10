---
name: Bug report
about: Something context-check did wrong
title: 'bug: '
labels: bug
---

## What happened

(One sentence.)

## What you expected

## How to reproduce

```
context-check --line < session.json
```

If you can include the JSON Claude Code piped to the statusline command,
that's almost always the fastest path to a fix. Strip anything sensitive
first (this tool reads the session JSON your statusline receives — it does
not phone home, but **you** are about to paste it into a public issue).

## Environment

- OS:
- Node version (`node -v`):
- context-check version (the git ref you installed from, e.g. `main` or `v1.1.0`):
- Claude Code version:
