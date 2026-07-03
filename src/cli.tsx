#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import React from 'react';
import { render } from 'ink';
import App from './App.js';
import { TorrentEngine } from './engine.js';
import { configPath, expandHome, loadConfig } from './config.js';

interface ParsedArgs {
  /** Overrides set on the command line (undefined = fall back to config). */
  downloadPath?: string;
  maxDownloadSpeed?: number;
  maxUploadSpeed?: number;
  torrents: string[];
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { torrents: [], help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '-o' || arg === '--out') {
      const next = argv[++i];
      if (next) args.downloadPath = path.resolve(expandHome(next));
    } else if (arg === '--down-limit') {
      const value = Number(argv[++i]);
      if (Number.isFinite(value) && value >= 0) args.maxDownloadSpeed = value;
    } else if (arg === '--up-limit') {
      const value = Number(argv[++i]);
      if (Number.isFinite(value) && value >= 0) args.maxUploadSpeed = value;
    } else {
      args.torrents.push(arg);
    }
  }

  return args;
}

const USAGE = `tui-torrent — a command-line torrent client

Usage:
  tui-torrent [options] [magnet-or-file ...]

Options:
  -o, --out <dir>        download directory (default: ./downloads)
  --down-limit <KB/s>    max download speed in KB/s (0 = unlimited)
  --up-limit <KB/s>      max upload speed in KB/s (0 = unlimited)
  -h, --help             show this help

Config file (defaults; command-line options take precedence):
  ${configPath()}
  Keys: downloadPath, maxDownloadSpeed, maxUploadSpeed, maxConnections

Examples:
  tui-torrent
  tui-torrent "magnet:?xt=urn:btih:..."
  tui-torrent -o ~/Downloads --up-limit 500 ./ubuntu.torrent
`;

const ESC = String.fromCharCode(27);

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  // The TUI needs raw keyboard input, which requires an interactive terminal.
  if (!process.stdin.isTTY) {
    process.stderr.write(
      'tui-torrent needs an interactive terminal (TTY).\n' +
        'Run it directly in your terminal rather than piping its input.\n',
    );
    process.exit(1);
  }

  // Command-line options override the config file, which overrides defaults.
  const { config, warning } = loadConfig();
  if (warning) process.stderr.write(`Warning: ${warning}\n`);

  const engine = new TorrentEngine({
    downloadPath: args.downloadPath ?? config.downloadPath,
    maxDownloadSpeed: args.maxDownloadSpeed ?? config.maxDownloadSpeed,
    maxUploadSpeed: args.maxUploadSpeed ?? config.maxUploadSpeed,
    maxConnections: config.maxConnections,
  });

  // Switch to the alternate screen buffer so the TUI is fullscreen and the
  // user's scrollback is restored intact on exit.
  let altScreenActive = false;
  const enterAltScreen = () => {
    if (altScreenActive) return;
    process.stdout.write(`${ESC}[?1049h`);
    altScreenActive = true;
  };
  const leaveAltScreen = () => {
    if (!altScreenActive) return;
    process.stdout.write(`${ESC}[?1049l`);
    altScreenActive = false;
  };
  enterAltScreen();
  // Safety net: always restore the main screen, even on an unexpected exit.
  process.on('exit', leaveAltScreen);

  const { waitUntilExit } = render(
    <App engine={engine} initialTorrents={args.torrents} />,
  );

  // Ensure a clean teardown if the process is asked to terminate.
  const shutdown = () => {
    engine.destroy(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGTERM', shutdown);

  waitUntilExit().then(() => {
    leaveAltScreen();
    process.exit(0);
  });
}

main();
