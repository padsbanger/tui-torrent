import React from 'react';
import { Box, Text } from 'ink';
import type { TorrentSnapshot } from '../engine.js';
import { formatEta, formatPercent, formatSpeed, progressBar } from '../format.js';

/** Left margin applied to every column after the first; shared with the header. */
export const COLUMN_GAP = 2;
/** Minimum width reserved for the flexible name column. */
export const NAME_MIN_WIDTH = 12;

const BAR_WIDTH = 16;

interface Props {
  torrent: TorrentSnapshot;
  selected: boolean;
  /** Current terminal width, used to decide which columns are visible. */
  termWidth: number;
}

function statusLabel(t: TorrentSnapshot): { text: string; color: string } {
  if (t.paused) return { text: '⏸ paused', color: 'yellow' };
  if (t.done) return { text: '✔ seeding', color: 'green' };
  if (!t.ready) return { text: '… metadata', color: 'gray' };
  return { text: '↓ downloading', color: 'cyan' };
}

/**
 * Data columns rendered after the name. `show(width)` decides visibility so the
 * table degrades gracefully on narrow terminals: progress/down/status are
 * always shown; eta, peers, then up appear as more width becomes available.
 * Array order is the on-screen order — filtering preserves it.
 */
export interface ColumnDef {
  key: string;
  header: string;
  width: number;
  alignRight?: boolean;
  show: (termWidth: number) => boolean;
  render: (t: TorrentSnapshot) => React.ReactNode;
}

export const DATA_COLUMNS: ColumnDef[] = [
  {
    key: 'progress',
    header: 'PROGRESS',
    width: 25,
    show: () => true,
    render: (t) => (
      <>
        <Text color={t.done ? 'green' : 'cyan'}>{progressBar(t.progress, BAR_WIDTH)}</Text>
        <Text> {formatPercent(t.progress).padStart(6)}</Text>
      </>
    ),
  },
  {
    key: 'down',
    header: 'DOWN',
    width: 11,
    alignRight: true,
    show: () => true,
    render: (t) => <Text color="green">{formatSpeed(t.downloadSpeed)}</Text>,
  },
  {
    key: 'up',
    header: 'UP',
    width: 11,
    alignRight: true,
    show: (w) => w >= 99,
    render: (t) => <Text color="magenta">{formatSpeed(t.uploadSpeed)}</Text>,
  },
  {
    key: 'peers',
    header: 'PEERS',
    width: 6,
    alignRight: true,
    show: (w) => w >= 86,
    render: (t) => <Text>{t.numPeers}</Text>,
  },
  {
    key: 'eta',
    header: 'ETA',
    width: 9,
    alignRight: true,
    show: (w) => w >= 78,
    render: (t) => (
      <Text dimColor>{t.done ? 'done' : formatEta(t.timeRemaining)}</Text>
    ),
  },
  {
    key: 'status',
    header: 'STATUS',
    width: 13,
    show: () => true,
    render: (t) => {
      const s = statusLabel(t);
      return (
        <Text color={s.color} wrap="truncate-end">
          {s.text}
        </Text>
      );
    },
  },
];

export default function TorrentRow({ torrent, selected, termWidth }: Props) {
  const columns = DATA_COLUMNS.filter((c) => c.show(termWidth));

  return (
    <Box>
      {/* Name (flexible) */}
      <Box flexGrow={1} minWidth={NAME_MIN_WIDTH}>
        <Text color={selected ? 'cyanBright' : undefined}>
          {selected ? '❯ ' : '  '}
        </Text>
        <Text
          bold={selected}
          color={selected ? 'cyanBright' : undefined}
          wrap="truncate-end"
        >
          {torrent.name}
        </Text>
      </Box>

      {columns.map((column) => (
        <Box
          key={column.key}
          width={column.width}
          flexShrink={0}
          marginLeft={COLUMN_GAP}
          justifyContent={column.alignRight ? 'flex-end' : 'flex-start'}
        >
          {column.render(torrent)}
        </Box>
      ))}
    </Box>
  );
}
