import React from 'react';
import { Box, Text } from 'ink';

const KEYS: Array<[string, string]> = [
  ['↑ / k', 'move selection up'],
  ['↓ / j', 'move selection down'],
  ['a', 'add a torrent (magnet or .torrent)'],
  ['p', 'pause / resume selected torrent'],
  ['o', 'open download folder'],
  ['c', 'copy magnet link to clipboard'],
  ['d / x', 'remove selected torrent (deletes data)'],
  ['?', 'toggle this help'],
  ['q / ctrl+c', 'quit'],
];

export default function Help() {
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold>Keyboard shortcuts</Text>
      <Box flexDirection="column" marginTop={1}>
        {KEYS.map(([key, description]) => (
          <Box key={key}>
            <Box width={14}>
              <Text color="cyan">{key}</Text>
            </Box>
            <Text>{description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Press <Text color="cyan">?</Text> or <Text color="cyan">esc</Text> to
          close.
        </Text>
      </Box>
    </Box>
  );
}
