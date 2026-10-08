# Zest for Freebuff

Track Freebuff CLI sessions in Zest: standups and how the team actually works
across every AI tool.

This repository is what `npx` runs. There is no marketplace and no compiled
runtime download.

## Install

Needs Node.js 18.4 or newer (you already have it if you installed Freebuff with npm).

```bash
npx -y --allow-git=root github:Winding-Labs/zest-freebuff install
npx -y --allow-git=root github:Winding-Labs/zest-freebuff login
```

`install` puts a small `freebuff` wrapper first on your PATH (a marked line at
the end of `~/.zshrc`, `~/.bashrc` or your bash login file such as
`~/.bash_profile`; fish users get one `fish_add_path` command to run). When you start `freebuff`, it starts Zest
beside it; Zest reads the chat files Freebuff writes and stops shortly after
the last Freebuff closes. Nothing is loaded into Freebuff and nothing runs
while it is closed. Open a new terminal after installing.

On Windows there is no wrapper: keep
`npx -y --allow-git=root github:Winding-Labs/zest-freebuff watch` running while
you use Freebuff.

`--allow-git=root` is needed from npm 12 on, which refuses packages fetched
from git otherwise; older npm ignores it (npm 11 prints a warning).

To update, run `install` again. Run it again too after upgrading or switching
Node: the wrapper runs Zest with the Node that installed it.

Full instructions: https://app.meetzest.com/docs/install/freebuff

## What it captures

Your prompts and Freebuff's answers from the Freebuff CLI, redacted on your
machine before they are sent. Freebuff keeps no token counts or model names
locally, so sessions show without them. The Codebuff CLI and Freebuff Desktop
are not captured.

## Commands

All run from a terminal as `npx -y --allow-git=root github:Winding-Labs/zest-freebuff <command>`.

| Command | What it does |
|---|---|
| `install` | Install or update the `freebuff` wrapper that starts capture |
| `uninstall` | Remove the wrapper and stop capture |
| `login` | Connect this machine to your Zest workspace |
| `logout` | Sign out of Zest |
| `status` | Capture, auth, workspace and sync state |
| `watch` | Capture in the foreground (Windows, or Freebuff started without the wrapper) |
| `sync` | Capture the current folder and upload now |
| `standup` | Generate today's standup |
| `enable` / `disable` | Turn remote sync on or off |
| `workspace` | View or switch workspace |
| `privacy` | View or configure privacy redaction |
| `ignore` / `unignore` | Stop or resume tracking the current folder |

## Notes

Source lives in the Zest monorepo; this repository is the distribution mirror
and is regenerated on every release.

## License

Proprietary — see LICENSE.md. Third-party components included in this
distribution are listed in THIRD-PARTY-NOTICES.md.

Questions: hi@winding.ai
