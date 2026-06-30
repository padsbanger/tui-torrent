import React from 'react';
import { Box, Text } from 'ink';
import { formatSpeed } from '../format.js';

interface Props {
  count: number;
  downloadSpeed: number;
  uploadSpeed: number;
  notice?: string;
}

export default function StatusBar({
  count,
  downloadSpeed,
  uploadSpeed,
  notice,
}: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Box>
        <Text dimColor>torrents </Text>
        <Text>{count}</Text>
        <Text dimColor>{'   '}↓ </Text>
        <Text color="green">{formatSpeed(downloadSpeed)}</Text>
        <Text dimColor>{'   '}↑ </Text>
        <Text color="magenta">{formatSpeed(uploadSpeed)}</Text>
      </Box>
      <Box>
        {notice ? (
          <Text color="yellow" wrap="truncate-end">
            {notice}
          </Text>
        ) : (
          <Text dimColor>
            <Text color="cyan">a</Text> add · <Text color="cyan">p</Text>{' '}
            pause · <Text color="cyan">d</Text> remove ·{' '}
            <Text color="cyan">enter</Text> details ·{' '}
            <Text color="cyan">?</Text> help · <Text color="cyan">q</Text> quit
          </Text>
        )}
      </Box>
    </Box>
  );
}
