# tui-torrent

A torrent client for the command line, built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) and [WebTorrent](https://webtorrent.io/).

```
 tui-torrent · a command-line torrent client

   NAME            PROGRESS                DOWN          UP  PEERS      ETA  STATUS
 ❯ ubuntu-24.04…   ████████░░░░  51.2%   3.10 MB/s  256 KB/s    42  12m 30s  ↓ downloading
   debian-12.iso   ████████████ 100.0%       0 B/s  512 KB/s     8     done  ✔ seeding

╭ details ─────────────────────────────────────────────────────────────────╮
│ ubuntu-24.04-desktop-amd64.iso                                            │
│ ████████░░░░  51.2%  2.45 GB / 4.79 GB  downloading                       │
│ ↓ 3.10 MB/s   ↑ 256 KB/s   peers 42   eta 12m 30s   ratio 0.17   1 file   │
│ ↓ graph ▂▃▄▅▆▇█▇▆▅▄▃  peak 4.29 MB/s                                       │
│ ↑ graph ▁▂▂▃▃▄▄▅▅▆▆▇  peak 256 KB/s                                        │
╰───────────────────────────────────────────────────────────────────────────╯
╭───────────────────────────────────────────────────────────────────────────╮
│ torrents 2   ↓ 3.10 MB/s   ↑ 768 KB/s                                      │
│ ↑↓ select · a add · p pause · o open · c magnet · d remove · ? help · q quit│
╰───────────────────────────────────────────────────────────────────────────╯
```

## Features

- A **fullscreen split UI**: the torrent list on top, live details for the selected torrent on the bottom
- Add torrents from a **magnet URI** or a **.torrent file**
- Live **download progress** with progress bars, speeds, peers, and ETA
- **Pause / resume / remove** torrents with single keystrokes
- **Seeding** of completed torrents and an always-visible **details pane** (stats, ratio, and live **download/upload sparklines**)
- **Open the download folder** or **copy the magnet link** to the clipboard
- **Session persistence** — your torrent list is saved and **resumed** on the next launch

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

| Option                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `-o, --out <dir>`       | Download directory (default: `./downloads`)       |
| `--down-limit <KB/s>`   | Max download speed in KB/s (0 = unlimited)        |
| `--up-limit <KB/s>`     | Max upload speed in KB/s (0 = unlimited)          |
| `-h, --help`            | Show help                                         |

## Configuration

On startup tui-torrent reads an optional JSON config file for its defaults.
**Command-line options always take precedence over the config file, which takes
precedence over the built-in defaults.**

Location:

- **Windows:** `%APPDATA%\tui-torrent\config.json`
- **macOS / Linux:** `$XDG_CONFIG_HOME/tui-torrent/config.json` (defaults to `~/.config/tui-torrent/config.json`)

All keys are optional; missing keys fall back to the defaults shown below.
Speeds are in **KB/s** (`0` = unlimited), matching common torrent clients.

```jsonc
{
  "downloadPath": "~/Downloads/torrents", // ~ is expanded to your home dir
  "maxDownloadSpeed": 0,                  // KB/s, 0 = unlimited
  "maxUploadSpeed": 500,                  // KB/s, 0 = unlimited
  "maxConnections": 55                    // max peers per torrent
}
```

If the file is present but unreadable or invalid JSON, tui-torrent prints a
warning and continues with the defaults rather than failing to start.

## Keyboard shortcuts

| Key            | Action                                  |
| -------------- | --------------------------------------- |
| `↑` / `k`      | Move selection up                       |
| `↓` / `j`      | Move selection down                     |
| `a`            | Add a torrent (magnet or .torrent path) |
| `p`            | Pause / resume selected torrent         |
| `o`            | Open the download folder                |
| `c`            | Copy the magnet link to the clipboard   |
| `d` / `x`      | Remove selected torrent (deletes data)  |
| `?`            | Toggle help                             |
| `q` / `ctrl+c` | Quit                                    |

## Project layout

```
src/
  cli.tsx              entry point: arg parsing + render
  App.tsx              top-level component, views, keyboard handling
  engine.ts            WebTorrent wrapper exposing snapshot-based state
  config.ts            load/validate the user config file (paths, limits)
  persistence.ts       load/save the session to a JSON state file
  system.ts            cross-platform open-folder / clipboard helpers
  format.ts            byte / speed / ETA / progress-bar helpers
  components/
    TorrentList.tsx    top pane: windowed, aligned torrent table
    TorrentRow.tsx     a single torrent row + column definitions
    DetailsPane.tsx    bottom pane: selected torrent stats + sparklines
    AddTorrent.tsx     magnet / file input prompt
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

The session (each torrent's magnet URI, download path, and paused state) is
written to a small JSON file whenever the list changes and re-added on the next
launch. Each torrent's `.torrent` metadata is cached alongside it (in a
`metadata/` folder), so on restart the torrent is reconstructed **instantly**
without having to re-fetch metadata from peers first. Progress itself is not
stored — WebTorrent re-verifies the existing data in the download directory, so
partial downloads resume where they left off. The state file lives at:

- **Windows:** `%APPDATA%\tui-torrent\state.json`
- **macOS / Linux:** `$XDG_CONFIG_HOME/tui-torrent/state.json` (defaults to `~/.config/tui-torrent/state.json`)

## License

MIT
