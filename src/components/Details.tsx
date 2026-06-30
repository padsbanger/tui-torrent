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
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Box width={14}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{value}</Text>
    </Box>
  );
}

export default function Details({ torrent }: Props) {
  const files = torrent.files.slice(0, 15);
  const hidden = torrent.files.length - files.length;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold wrap="truncate-end">
        {torrent.name}
      </Text>
      <Text dimColor wrap="truncate-end">
        {torrent.infoHash}
      </Text>

      <Box marginTop={1}>
        <Text color={torrent.done ? 'green' : 'cyan'}>
          {progressBar(torrent.progress, 32)}
        </Text>
        <Text> {formatPercent(torrent.progress)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Stat
          label="Status"
          value={
            torrent.paused
              ? 'paused'
              : torrent.done
                ? 'seeding'
                : torrent.ready
                  ? 'downloading'
                  : 'fetching metadata'
          }
        />
        <Stat
          label="Size"
          value={`${formatBytes(torrent.downloaded)} / ${formatBytes(torrent.length)}`}
        />
        <Stat label="Download" value={formatSpeed(torrent.downloadSpeed)} />
        <Stat label="Upload" value={formatSpeed(torrent.uploadSpeed)} />
        <Stat label="Uploaded" value={formatBytes(torrent.uploaded)} />
        <Stat label="Ratio" value={torrent.ratio.toFixed(2)} />
        <Stat label="Peers" value={String(torrent.numPeers)} />
        <Stat
          label="ETA"
          value={torrent.done ? 'done' : formatEta(torrent.timeRemaining)}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Files ({torrent.files.length})</Text>
        {files.map((file, index) => (
          <Box key={`${file.path}-${index}`}>
            <Box width={8}>
              <Text color="cyan">{formatPercent(file.progress)}</Text>
            </Box>
            <Text wrap="truncate-end">{file.name}</Text>
            <Text dimColor> ({formatBytes(file.length)})</Text>
          </Box>
        ))}
        {hidden > 0 && <Text dimColor>…and {hidden} more</Text>}
        {torrent.files.length === 0 && (
          <Text dimColor>No file metadata yet.</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          <Text color="cyan">esc</Text> back · <Text color="cyan">p</Text>{' '}
          pause/resume · <Text color="cyan">d</Text> remove
        </Text>
      </Box>
    </Box>
  );
}
