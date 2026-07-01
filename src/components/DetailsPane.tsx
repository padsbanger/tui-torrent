import React from 'react';
import { Box, Text } from 'ink';
import type { TorrentSnapshot } from '../engine.js';
import type { SpeedHistory } from '../format.js';
import {
  formatBytes,
  formatEta,
  formatPercent,
  formatSpeed,
  progressBar,
  sparkline,
} from '../format.js';

interface Props {
  torrent?: TorrentSnapshot;
  history?: SpeedHistory;
  /** Total pane height in rows (including border). */
  height: number;
  /** Terminal width, used to size the sparkline. */
  width: number;
}

function statusText(t: TorrentSnapshot): { text: string; color: string } {
  if (t.paused) return { text: 'paused', color: 'yellow' };
  if (t.done) return { text: 'seeding', color: 'green' };
  if (!t.ready) return { text: 'metadata', color: 'gray' };
  return { text: 'downloading', color: 'cyan' };
}

/** Compact, always-visible details for the selected torrent (bottom pane). */
export default function DetailsPane({ torrent, history, height, width }: Props) {
  const down = history?.down ?? [];
  const up = history?.up ?? [];
  const sparkWidth = Math.max(10, Math.min(40, width - 34));

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      height={height}
      paddingX={1}
      overflow="hidden"
    >
      {torrent ? (
        <>
          <Text bold wrap="truncate-end">
            {torrent.name}
          </Text>
          <Box>
            <Text color={torrent.done ? 'green' : 'cyan'}>
              {progressBar(torrent.progress, 20)}
            </Text>
            <Text> {formatPercent(torrent.progress).padStart(6)}</Text>
            <Text dimColor>
              {'  '}
              {formatBytes(torrent.downloaded)} / {formatBytes(torrent.length)}
            </Text>
            <Text>{'  '}</Text>
            <Text color={statusText(torrent).color}>{statusText(torrent).text}</Text>
          </Box>
          <Box>
            <Text color="green">↓ {formatSpeed(torrent.downloadSpeed)}</Text>
            <Text>{'   '}</Text>
            <Text color="magenta">↑ {formatSpeed(torrent.uploadSpeed)}</Text>
            <Text dimColor>
              {'   '}peers {torrent.numPeers}
              {'   '}eta {torrent.done ? 'done' : formatEta(torrent.timeRemaining)}
              {'   '}ratio {torrent.ratio.toFixed(2)}
              {'   '}
              {torrent.files.length} file{torrent.files.length === 1 ? '' : 's'}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Box width={8}>
              <Text dimColor>↓ graph</Text>
            </Box>
            <Text color="green">{sparkline(down, sparkWidth)}</Text>
            <Text dimColor> peak {formatSpeed(down.length ? Math.max(...down) : 0)}</Text>
          </Box>
          <Box>
            <Box width={8}>
              <Text dimColor>↑ graph</Text>
            </Box>
            <Text color="magenta">{sparkline(up, sparkWidth)}</Text>
            <Text dimColor> peak {formatSpeed(up.length ? Math.max(...up) : 0)}</Text>
          </Box>
        </>
      ) : (
        <Text dimColor>No torrent selected — press a to add one.</Text>
      )}
    </Box>
  );
}
