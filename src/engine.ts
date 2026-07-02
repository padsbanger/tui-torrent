import { EventEmitter } from 'node:events';
import WebTorrent from 'webtorrent';
import { copyToClipboard, openPath } from './system.js';
import {
  deleteMetadata,
  infoHashFromMagnet,
  loadMetadata,
  loadState,
  saveMetadata,
  saveState,
  type PersistedTorrent,
} from './persistence.js';

type Torrent = WebTorrent.Torrent;
type Instance = WebTorrent.Instance;

/** Immutable view of a single file inside a torrent. */
export interface FileSnapshot {
  name: string;
  length: number;
  progress: number;
  path: string;
}

/** Immutable view of a torrent's state at a point in time, for rendering. */
export interface TorrentSnapshot {
  infoHash: string;
  name: string;
  progress: number; // 0..1
  downloaded: number;
  uploaded: number;
  length: number;
  downloadSpeed: number; // bytes/s
  uploadSpeed: number; // bytes/s
  numPeers: number;
  timeRemaining: number; // seconds (Infinity if unknown)
  ratio: number;
  paused: boolean;
  done: boolean;
  ready: boolean; // metadata received
  files: FileSnapshot[];
}

export interface EngineEvents {
  /** A human-readable message worth surfacing to the user. */
  notice: (message: string) => void;
  /** A torrent finished downloading. */
  done: (name: string) => void;
}

/**
 * Thin wrapper around a WebTorrent client that exposes a stable, snapshot-based
 * API for the TUI. The UI polls {@link getSnapshots} on an interval rather than
 * subscribing to the firehose of per-piece events.
 */
export interface EngineOptions {
  /** Default download directory for newly added torrents. */
  downloadPath: string;
  /** Max download speed in KB/s; 0 means unlimited. */
  maxDownloadSpeed?: number;
  /** Max upload speed in KB/s; 0 means unlimited. */
  maxUploadSpeed?: number;
  /** Max peer connections per torrent. */
  maxConnections?: number;
}

/** KB/s (0 = unlimited) -> bytes/s for WebTorrent (-1 = unlimited). */
function toByteLimit(kbPerSecond: number | undefined): number {
  return kbPerSecond && kbPerSecond > 0 ? kbPerSecond * 1024 : -1;
}

export class TorrentEngine extends EventEmitter {
  private client: Instance;
  /** Tracks paused torrents by infoHash so we don't depend on engine internals. */
  private pausedHashes = new Set<string>();
  private downloadPath: string;

  constructor(options: EngineOptions) {
    super();
    this.downloadPath = options.downloadPath;
    this.client = new WebTorrent({
      maxConns: options.maxConnections,
      downloadLimit: toByteLimit(options.maxDownloadSpeed),
      uploadLimit: toByteLimit(options.maxUploadSpeed),
    });
    this.client.on('error', (err: unknown) => {
      this.emit('notice', `Client error: ${errorMessage(err)}`);
    });
  }

  /** Add a torrent from a magnet URI, .torrent file path/contents, or info hash. */
  add(
    torrentId: string | Buffer,
    options: { path?: string; paused?: boolean } = {},
  ): void {
    const id = typeof torrentId === 'string' ? torrentId.trim() : torrentId;
    if (typeof id === 'string' && !id) return;

    try {
      const torrent = this.client.add(id, {
        path: options.path ?? this.downloadPath,
      });
      this.wireTorrent(torrent);
      if (options.paused) {
        this.pausedHashes.add(torrent.infoHash);
        this.setActive(torrent, false);
      }
    } catch (err) {
      this.emit('notice', `Failed to add torrent: ${errorMessage(err)}`);
    }
  }

  /** Re-add torrents saved from a previous session and resume their data. */
  restore(): void {
    let saved: PersistedTorrent[];
    try {
      saved = loadState();
    } catch (err) {
      this.emit('notice', `Could not load saved session: ${errorMessage(err)}`);
      return;
    }
    for (const entry of saved) {
      // Prefer saved .torrent metadata: it lets WebTorrent verify on-disk data
      // and resume immediately, without first re-fetching metadata from peers.
      const infoHash = entry.infoHash ?? infoHashFromMagnet(entry.torrentId);
      const metadata = infoHash ? loadMetadata(infoHash) : undefined;
      this.add(metadata ?? entry.torrentId, {
        path: entry.path,
        paused: entry.paused,
      });
    }
    if (saved.length > 0) {
      this.emit('notice', `Restored ${saved.length} torrent(s)`);
    }
  }

  private wireTorrent(torrent: Torrent): void {
    torrent.on('error', (err: unknown) => {
      this.emit('notice', `Torrent error: ${errorMessage(err)}`);
    });
    torrent.on('ready', () => {
      this.emit('notice', `Added: ${torrent.name}`);
      // Save the .torrent metadata so the next session can resume instantly.
      if (torrent.torrentFile) {
        try {
          saveMetadata(torrent.infoHash, torrent.torrentFile);
        } catch {
          // Non-fatal: we can still resume from the magnet, just slower.
        }
      }
      // A torrent paused before metadata arrived now has pieces to deselect.
      if (this.pausedHashes.has(torrent.infoHash)) this.setActive(torrent, false);
      this.persist();
    });
    torrent.on('done', () => {
      this.emit('done', torrent.name);
      this.emit('notice', `Completed: ${torrent.name}`);
    });
  }

  /** Write the current torrent list to disk for the next session. */
  private persist(): void {
    try {
      saveState(
        this.client.torrents.map((t) => ({
          infoHash: t.infoHash,
          torrentId: t.magnetURI || `magnet:?xt=urn:btih:${t.infoHash}`,
          path: t.path,
          paused: this.pausedHashes.has(t.infoHash),
        })),
      );
    } catch (err) {
      this.emit('notice', `Could not save session: ${errorMessage(err)}`);
    }
  }

  /** Locate a torrent by infoHash without the async client.get(). */
  private find(infoHash: string): Torrent | undefined {
    return this.client.torrents.find((t) => t.infoHash === infoHash);
  }

  /** Toggle paused state for a torrent; returns the new paused state. */
  togglePause(infoHash: string): boolean {
    const torrent = this.find(infoHash);
    if (!torrent) return false;
    if (this.pausedHashes.has(infoHash)) {
      this.pausedHashes.delete(infoHash);
      this.setActive(torrent, true);
      this.emit('notice', `Resumed: ${torrent.name}`);
      this.persist();
      return false;
    }
    this.pausedHashes.add(infoHash);
    this.setActive(torrent, false);
    this.emit('notice', `Paused: ${torrent.name}`);
    this.persist();
    return true;
  }

  /**
   * Start or stop transfer for a torrent. WebTorrent's `pause()` only blocks
   * *new* peer connections — already-connected peers keep sending data, so a
   * plain pause appears to "un-pause" itself. To truly halt the transfer we
   * also deselect every piece (drops our interest, so existing peers stop),
   * and re-select on resume.
   */
  private setActive(torrent: Torrent, active: boolean): void {
    const lastPiece = torrent.pieces && torrent.pieces.length - 1;
    const ready = typeof lastPiece === 'number' && lastPiece >= 0;
    if (active) {
      if (ready) torrent.select(0, lastPiece, 0);
      torrent.resume();
      this.reannounce(torrent);
    } else {
      if (ready) torrent.deselect(0, lastPiece, 0);
      torrent.pause();
    }
  }

  /**
   * Ask trackers and the DHT for peers right now. WebTorrent only re-announces
   * on a timer, so a torrent resumed after its peers dropped during a long
   * pause could otherwise sit at zero peers. This mirrors WebTorrent's own
   * behavior when it re-selects previously-unmarked pieces (it calls
   * `tracker.start()`), getting the download moving again quickly.
   */
  private reannounce(torrent: Torrent): void {
    const discovery = (
      torrent as unknown as {
        discovery?: {
          tracker?: { update?: () => void };
          _dhtAnnounce?: () => void;
        };
      }
    ).discovery;
    try {
      discovery?.tracker?.update?.();
      discovery?._dhtAnnounce?.();
    } catch {
      // Best-effort; periodic announces will recover peers regardless.
    }
  }

  /** Remove a torrent and delete its partial data from disk. */
  remove(infoHash: string): void {
    const torrent = this.find(infoHash);
    if (!torrent) return;
    const name = torrent.name;
    this.pausedHashes.delete(infoHash);
    deleteMetadata(infoHash);
    this.client.remove(infoHash, { destroyStore: true }, (err?: Error | string) => {
      if (err) this.emit('notice', `Failed to remove: ${errorMessage(err)}`);
      else this.emit('notice', `Removed: ${name || infoHash}`);
      this.persist();
    });
  }

  /** Open the torrent's download directory in the OS file manager. */
  async openFolder(infoHash: string): Promise<void> {
    const torrent = this.find(infoHash);
    if (!torrent) return;
    try {
      await openPath(torrent.path);
      this.emit('notice', `Opened folder: ${torrent.path}`);
    } catch (err) {
      this.emit('notice', `Failed to open folder: ${errorMessage(err)}`);
    }
  }

  /** Copy the torrent's magnet URI to the system clipboard. */
  async copyMagnet(infoHash: string): Promise<void> {
    const torrent = this.find(infoHash);
    if (!torrent) return;
    if (!torrent.magnetURI) {
      this.emit('notice', 'Magnet URI not available yet');
      return;
    }
    try {
      await copyToClipboard(torrent.magnetURI);
      this.emit('notice', `Copied magnet link: ${torrent.name}`);
    } catch (err) {
      this.emit('notice', `Failed to copy magnet: ${errorMessage(err)}`);
    }
  }

  /** Snapshot every torrent's current state for rendering. */
  getSnapshots(): TorrentSnapshot[] {
    return this.client.torrents.map((t) => this.toSnapshot(t));
  }

  /** Aggregate down/up speed across all torrents. */
  getTotals(): { downloadSpeed: number; uploadSpeed: number; ratio: number } {
    return {
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      ratio: this.client.ratio,
    };
  }

  private toSnapshot(t: Torrent): TorrentSnapshot {
    const ready = Boolean(t.name) && t.length > 0;
    return {
      infoHash: t.infoHash,
      name: t.name || t.infoHash || 'fetching metadata…',
      progress: t.progress,
      downloaded: t.downloaded,
      uploaded: t.uploaded,
      length: t.length,
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
      numPeers: t.numPeers,
      timeRemaining: this.pausedHashes.has(t.infoHash)
        ? Infinity
        : t.timeRemaining / 1000,
      ratio: t.ratio,
      paused: this.pausedHashes.has(t.infoHash),
      done: t.done,
      ready,
      files: (t.files ?? []).map((f) => ({
        name: f.name,
        length: f.length,
        progress: f.progress,
        path: f.path,
      })),
    };
  }

  /** Tear down the client; call on exit. */
  destroy(callback?: () => void): void {
    this.client.destroy(() => callback?.());
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
