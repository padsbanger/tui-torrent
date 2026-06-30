import React from 'react';
import { Box, Text } from 'ink';
import type { TorrentSnapshot } from '../engine.js';
import TorrentRow from './TorrentRow.js';

interface Props {
  torrents: TorrentSnapshot[];
  selectedIndex: number;
}

export default function TorrentList({ torrents, selectedIndex }: Props) {
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

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      {torrents.map((torrent, index) => (
        <TorrentRow
          key={torrent.infoHash || index}
          torrent={torrent}
          selected={index === selectedIndex}
        />
      ))}
    </Box>
  );
}
