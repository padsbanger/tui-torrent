import React from 'react';
import { Box, Text } from 'ink';
import type { TorrentSnapshot } from '../engine.js';
import {
  formatBytes,
  formatEta,
  formatPercent,
  formatSpeed,
  progressBar,
} from '../format.js';

interface Props {
  torrent: TorrentSnapshot;
  selected: boolean;
}

function statusLabel(t: TorrentSnapshot): { text: string; color: string } {
  if (t.paused) return { text: '⏸ paused', color: 'yellow' };
  if (t.done) return { text: '✔ seeding', color: 'green' };
  if (!t.ready) return { text: '… meta', color: 'gray' };
  return { text: '↓ downloading', color: 'cyan' };
}

export default function TorrentRow({ torrent, selected }: Props) {
  const status = statusLabel(torrent);
  const bar = progressBar(torrent.progress, 24);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={selected ? 'cyanBright' : undefined}>
          {selected ? '❯ ' : '  '}
        </Text>
        <Text bold={selected} wrap="truncate-end">
          {torrent.name}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={torrent.done ? 'green' : 'cyan'}>{bar}</Text>
        <Text> {formatPercent(torrent.progress)}</Text>
        <Text dimColor>
          {'  '}
          {formatBytes(torrent.downloaded)} / {formatBytes(torrent.length)}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={status.color}>{status.text}</Text>
        <Text dimColor>{'  '}</Text>
        <Text color="green">↓ {formatSpeed(torrent.downloadSpeed)}</Text>
        <Text dimColor>{'  '}</Text>
        <Text color="magenta">↑ {formatSpeed(torrent.uploadSpeed)}</Text>
        <Text dimColor>
          {'  '}peers {torrent.numPeers}
          {'  '}eta {torrent.done ? 'done' : formatEta(torrent.timeRemaining)}
        </Text>
      </Box>
    </Box>
  );
}
