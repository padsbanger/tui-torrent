import React from 'react';
import { Box, Text } from 'ink';
import type { TorrentSnapshot } from '../engine.js';
import TorrentRow, {
  COLUMN_GAP,
  DATA_COLUMNS,
  NAME_MIN_WIDTH,
} from './TorrentRow.js';

interface Props {
  torrents: TorrentSnapshot[];
  selectedIndex: number;
  /** Terminal width, used to decide which columns are visible. */
  termWidth: number;
  /** Maximum number of torrent rows to render (the list windows around the selection). */
  maxVisible: number;
}

/** Header row; column visibility/widths mirror TorrentRow via DATA_COLUMNS. */
function TableHeader({ termWidth }: { termWidth: number }) {
  return (
    <Box>
      <Box flexGrow={1} minWidth={NAME_MIN_WIDTH}>
        <Text dimColor>{'  NAME'}</Text>
      </Box>
      {DATA_COLUMNS.filter((c) => c.show(termWidth)).map((column) => (
        <Box
          key={column.key}
          width={column.width}
          flexShrink={0}
          marginLeft={COLUMN_GAP}
          justifyContent={column.alignRight ? 'flex-end' : 'flex-start'}
        >
          <Text dimColor>{column.header}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default function TorrentList({
  torrents,
  selectedIndex,
  termWidth,
  maxVisible,
}: Props) {
  if (torrents.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1} paddingX={2}>
        <Text dimColor>No torrents yet.</Text>
        <Text dimColor>
          Press <Text color="cyan">a</Text> to add a magnet link or .torrent
          file.
        </Text>
      </Box>
    );
  }

  // Window the list around the selection so it never exceeds the available rows.
  const total = torrents.length;
  const visible = Math.max(1, maxVisible);
  const start =
    total > visible
      ? Math.min(Math.max(0, selectedIndex - Math.floor(visible / 2)), total - visible)
      : 0;
  const shown = torrents.slice(start, start + visible);

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      <TableHeader termWidth={termWidth} />
      {shown.map((torrent, index) => (
        <TorrentRow
          key={torrent.infoHash || start + index}
          torrent={torrent}
          selected={start + index === selectedIndex}
          termWidth={termWidth}
        />
      ))}
    </Box>
  );
}
