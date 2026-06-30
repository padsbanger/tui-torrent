import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { TorrentEngine, TorrentSnapshot } from './engine.js';
import TorrentList from './components/TorrentList.js';
import AddTorrent from './components/AddTorrent.js';
import Details from './components/Details.js';
import Help from './components/Help.js';
import StatusBar from './components/StatusBar.js';

type View = 'list' | 'add' | 'details' | 'help';

interface Props {
  engine: TorrentEngine;
  /** Optional torrent ids to add on startup (from CLI args). */
  initialTorrents?: string[];
}

const POLL_INTERVAL_MS = 1000;
const NOTICE_TIMEOUT_MS = 4000;

export default function App({ engine, initialTorrents = [] }: Props) {
  const { exit } = useApp();
  const [view, setView] = useState<View>('list');
  const [torrents, setTorrents] = useState<TorrentSnapshot[]>([]);
  const [totals, setTotals] = useState({ downloadSpeed: 0, uploadSpeed: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notice, setNotice] = useState<string | undefined>();
  const noticeTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  // Surface engine notices transiently in the status bar.
  useEffect(() => {
    const onNotice = (message: string) => {
      setNotice(message);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(undefined), NOTICE_TIMEOUT_MS);
    };
    engine.on('notice', onNotice);
    return () => {
      engine.off('notice', onNotice);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [engine]);

  // Add any torrents passed on the command line.
  useEffect(() => {
    for (const id of initialTorrents) engine.add(id);
  }, [engine, initialTorrents]);

  // Poll the engine for fresh snapshots.
  useEffect(() => {
    const tick = () => {
      setTorrents(engine.getSnapshots());
      const t = engine.getTotals();
      setTotals({ downloadSpeed: t.downloadSpeed, uploadSpeed: t.uploadSpeed });
    };
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [engine]);

  // Keep the selection within bounds as the list grows or shrinks.
  useEffect(() => {
    setSelectedIndex((index) =>
      torrents.length === 0 ? 0 : Math.min(index, torrents.length - 1),
    );
  }, [torrents.length]);

  const selected: TorrentSnapshot | undefined = torrents[selectedIndex];

  const quit = () => {
    engine.destroy(() => exit());
    // Fallback in case destroy stalls.
    setTimeout(() => exit(), 1500);
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        quit();
        return;
      }

      if (view === 'help') {
        if (input === '?' || key.escape) setView('list');
        return;
      }

      if (view === 'details') {
        if (key.escape) setView('list');
        else if (input === 'p' && selected) engine.togglePause(selected.infoHash);
        else if ((input === 'd' || input === 'x') && selected) {
          engine.remove(selected.infoHash);
          setView('list');
        }
        return;
      }

      // list view
      if (input === 'q') quit();
      else if (input === 'a') setView('add');
      else if (input === '?') setView('help');
      else if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(torrents.length - 1, i + 1));
      } else if (key.return && selected) {
        setView('details');
      } else if (input === 'p' && selected) {
        engine.togglePause(selected.infoHash);
      } else if ((input === 'd' || input === 'x') && selected) {
        engine.remove(selected.infoHash);
      }
    },
    { isActive: view !== 'add' },
  );

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text bold color="cyanBright">
          tui-torrent
        </Text>
        <Text dimColor> · a command-line torrent client</Text>
      </Box>

      {view === 'list' && (
        <TorrentList torrents={torrents} selectedIndex={selectedIndex} />
      )}
      {view === 'add' && (
        <AddTorrent
          onSubmit={(value) => {
            engine.add(value);
            setView('list');
          }}
          onCancel={() => setView('list')}
        />
      )}
      {view === 'details' &&
        (selected ? (
          <Details torrent={selected} />
        ) : (
          <Box padding={1}>
            <Text dimColor>Torrent no longer available.</Text>
          </Box>
        ))}
      {view === 'help' && <Help />}

      <StatusBar
        count={torrents.length}
        downloadSpeed={totals.downloadSpeed}
        uploadSpeed={totals.uploadSpeed}
        notice={notice}
      />
    </Box>
  );
}
