# tui-torrent

A torrent client for the command line, built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) and [WebTorrent](https://webtorrent.io/).

```
 tui-torrent · a command-line torrent client

 ❯ ubuntu-24.04-desktop-amd64.iso
   ████████████░░░░░░░░░░░░ 51.2%  2.45 GB / 4.79 GB
   ↓ downloading  ↓ 3.10 MB/s  ↑ 256 KB/s  peers 42  eta 12m 30s

╭──────────────────────────────────────────────────────────────╮
│ torrents 1   ↓ 3.10 MB/s   ↑ 256 KB/s                          │
│ a add · p pause · d remove · enter details · ? help · q quit   │
╰──────────────────────────────────────────────────────────────╯
```

## Features

- Add torrents from a **magnet URI** or a **.torrent file**
- Live **download progress** with progress bars, speeds, peers, and ETA
- **Pause / resume / remove** torrents with single keystrokes
- **Seeding** of completed torrents and a per-torrent **details view** (file list, ratio, etc.)

## Requirements

- Node.js 18 or newer
- An interactive terminal (the TUI needs raw keyboard input)

## Install

```sh
npm install
npm run build
```

## Usage

Run in development (no build step, via `tsx`):

```sh
npm run dev
```

Or build and run the compiled CLI:

```sh
npm run build
npm start
```

You can also pass torrents and a download directory on the command line:

```sh
# start with a magnet link
node dist/cli.js "magnet:?xt=urn:btih:..."

# choose where files are saved
node dist/cli.js -o ~/Downloads ./ubuntu.torrent
```

### Options

| Option            | Description                                  |
| ----------------- | -------------------------------------------- |
| `-o, --out <dir>` | Download directory (default: `./downloads`)  |
| `-h, --help`      | Show help                                    |

## Keyboard shortcuts

| Key            | Action                                  |
| -------------- | --------------------------------------- |
| `↑` / `k`      | Move selection up                       |
| `↓` / `j`      | Move selection down                     |
| `a`            | Add a torrent (magnet or .torrent path) |
| `p`            | Pause / resume selected torrent         |
| `d` / `x`      | Remove selected torrent (deletes data)  |
| `enter`        | Open the details view                   |
| `?`            | Toggle help                             |
| `q` / `ctrl+c` | Quit                                    |

## Project layout

```
src/
  cli.tsx              entry point: arg parsing + render
  App.tsx              top-level component, views, keyboard handling
  engine.ts            WebTorrent wrapper exposing snapshot-based state
  format.ts            byte / speed / ETA / progress-bar helpers
  components/
    TorrentList.tsx    list of torrents (empty state included)
    TorrentRow.tsx     a single torrent row
    AddTorrent.tsx     magnet / file input prompt
    Details.tsx        per-torrent details and file list
    Help.tsx           keyboard shortcut reference
    StatusBar.tsx      totals + transient notices
```

## How it works

`TorrentEngine` wraps a single `WebTorrent` client and exposes a stable,
**snapshot-based** API. The UI polls `getSnapshots()` once per second rather
than subscribing to WebTorrent's high-frequency per-piece events, which keeps
rendering cheap and the component tree simple. User-facing events (added,
completed, errors) are emitted as `notice` events and shown briefly in the
status bar.

## License

MIT
