#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import React from 'react';
import { render } from 'ink';
import App from './App.js';
import { TorrentEngine } from './engine.js';

interface ParsedArgs {
  downloadPath: string;
  torrents: string[];
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const torrents: string[] = [];
  let downloadPath = path.join(process.cwd(), 'downloads');
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      help = true;
    } else if (arg === '-o' || arg === '--out') {
      const next = argv[++i];
      if (next) downloadPath = path.resolve(next);
    } else {
      torrents.push(arg);
    }
  }

  return { downloadPath, torrents, help };
}

const USAGE = `tui-torrent — a command-line torrent client

Usage:
  tui-torrent [options] [magnet-or-file ...]

Options:
  -o, --out <dir>   download directory (default: ./downloads)
  -h, --help        show this help

Examples:
  tui-torrent
  tui-torrent "magnet:?xt=urn:btih:..."
  tui-torrent -o ~/Downloads ./ubuntu.torrent
`;

function main() {
  const { downloadPath, torrents, help } = parseArgs(process.argv.slice(2));

  if (help) {
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

  const engine = new TorrentEngine(downloadPath);
  const { waitUntilExit } = render(
    <App engine={engine} initialTorrents={torrents} />,
  );

  // Ensure a clean teardown if the process is asked to terminate.
  const shutdown = () => {
    engine.destroy(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGTERM', shutdown);

  waitUntilExit().then(() => process.exit(0));
}

main();
