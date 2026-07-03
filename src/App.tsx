import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type { TorrentEngine, TorrentSnapshot } from './engine.js';
import type { SpeedHistory } from './format.js';
import TorrentList from './components/TorrentList.js';
import AddTorrent from './components/AddTorrent.js';
import DetailsPane from './components/DetailsPane.js';
import Help from './components/Help.js';
import StatusBar from './components/StatusBar.js';

type View = 'normal' | 'add' | 'help';

interface Props {
  engine: TorrentEngine;
  /** Optional torrent ids to add on startup (from CLI args). */
  initialTorrents?: string[];
}

const POLL_INTERVAL_MS = 1000;
const NOTICE_TIMEOUT_MS = 4000;
/** Number of speed samples (≈ seconds) kept per torrent for the sparkline. */
const HISTORY_LENGTH = 60;

// Fixed-height regions; the list fills whatever is left.
const HEADER_HEIGHT = 1;
const STATUSBAR_HEIGHT = 4; // bordered box: 2 borders + 2 content lines
const DETAILS_HEIGHT = 9; // bordered details/add pane

/** Track the terminal size and re-render on resize. */
function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24,
  });
  useEffect(() => {
    const onResize = () =>
      setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);
  return size;
}

export default function App({ engine, initialTorrents = [] }: Props) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();
  const [view, setView] = useState<View>('normal');
  const [torrents, setTorrents] = useState<TorrentSnapshot[]>([]);
  const [totals, setTotals] = useState({ downloadSpeed: 0, uploadSpeed: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notice, setNotice] = useState<string | undefined>();
  const noticeTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  // Rolling per-torrent speed samples for the details-view sparkline.
  const speedHistory = useRef<Map<string, SpeedHistory>>(new Map());

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

  // Restore the previous session, then add any torrents passed on the command line.
  useEffect(() => {
    engine.restore();
    for (const id of initialTorrents) engine.add(id);
  }, [engine, initialTorrents]);

  // Poll the engine for fresh snapshots and accumulate speed history.
  useEffect(() => {
    const tick = () => {
      const snapshots = engine.getSnapshots();
      recordSpeeds(speedHistory.current, snapshots);
      setTorrents(snapshots);
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
        if (input === '?' || key.escape) setView('normal');
        return;
      }

      // normal (split) view
      if (input === 'q') quit();
      else if (input === 'a') setView('add');
      else if (input === '?') setView('help');
      else if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(torrents.length - 1, i + 1));
      } else if (input === 'p' && selected) {
        engine.togglePause(selected.infoHash);
      } else if (input === 'o' && selected) {
        void engine.openFolder(selected.infoHash);
      } else if (input === 'c' && selected) {
        void engine.copyMagnet(selected.infoHash);
      } else if ((input === 'd' || input === 'x') && selected) {
        engine.remove(selected.infoHash);
      }
    },
    { isActive: view !== 'add' },
  );

  const listAreaHeight = Math.max(
    3,
    rows - HEADER_HEIGHT - STATUSBAR_HEIGHT - DETAILS_HEIGHT,
  );
  // One row of the list area is the column header.
  const maxVisible = Math.max(1, listAreaHeight - 1);

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box paddingX={1}>
        <Text bold color="cyanBright">
          tui-torrent
        </Text>
        <Text dimColor> · a command-line torrent client</Text>
      </Box>

      {view === 'help' ? (
        <Box flexGrow={1}>
          <Help />
        </Box>
      ) : (
        <>
          <Box flexGrow={1} flexDirection="column" overflow="hidden">
            <TorrentList
              torrents={torrents}
              selectedIndex={selectedIndex}
              termWidth={columns}
              maxVisible={maxVisible}
            />
          </Box>

          {view === 'add' ? (
            <Box
              borderStyle="round"
              borderColor="cyan"
              height={DETAILS_HEIGHT}
              paddingX={1}
              overflow="hidden"
            >
              <AddTorrent
                onSubmit={(value) => {
                  engine.add(value);
                  setView('normal');
                }}
                onCancel={() => setView('normal')}
              />
            </Box>
          ) : (
            <DetailsPane
              torrent={selected}
              history={selected ? speedHistory.current.get(selected.infoHash) : undefined}
              height={DETAILS_HEIGHT}
              width={columns}
            />
          )}
        </>
      )}

      <StatusBar
        count={torrents.length}
        downloadSpeed={totals.downloadSpeed}
        uploadSpeed={totals.uploadSpeed}
        notice={notice}
      />
    </Box>
  );
}

/**
 * Append the current down/up speed of each torrent to its rolling history,
 * capping length and dropping history for torrents that no longer exist.
 */
function recordSpeeds(
  history: Map<string, SpeedHistory>,
  snapshots: TorrentSnapshot[],
): void {
  const live = new Set<string>();
  for (const t of snapshots) {
    live.add(t.infoHash);
    let entry = history.get(t.infoHash);
    if (!entry) {
      entry = { down: [], up: [] };
      history.set(t.infoHash, entry);
    }
    entry.down.push(t.downloadSpeed);
    entry.up.push(t.uploadSpeed);
    if (entry.down.length > HISTORY_LENGTH) entry.down.shift();
    if (entry.up.length > HISTORY_LENGTH) entry.up.shift();
  }
  for (const hash of history.keys()) {
    if (!live.has(hash)) history.delete(hash);
  }
}
