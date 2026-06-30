import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function AddTorrent({ onSubmit, onCancel }: Props) {
  const [value, setValue] = useState('');

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  const handleSubmit = (submitted: string) => {
    const trimmed = submitted.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold>Add a torrent</Text>
      <Text dimColor>Paste a magnet URI or path to a .torrent file:</Text>
      <Box marginTop={1}>
        <Text color="cyan">{'> '}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="magnet:?xt=urn:btih:… or ./file.torrent"
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          <Text color="cyan">enter</Text> add · <Text color="cyan">esc</Text>{' '}
          cancel
        </Text>
      </Box>
    </Box>
  );
}
