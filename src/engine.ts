import { EventEmitter } from 'node:events';
import WebTorrent from 'webtorrent';

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
export class TorrentEngine extends EventEmitter {
  private client: Instance;
  /** Tracks paused torrents by infoHash so we don't depend on engine internals. */
  private pausedHashes = new Set<string>();
  private downloadPath: string;

  constructor(downloadPath: string) {
    super();
    this.downloadPath = downloadPath;
    this.client = new WebTorrent();
    this.client.on('error', (err: unknown) => {
      this.emit('notice', `Client error: ${errorMessage(err)}`);
    });
  }

  /** Add a torrent from a magnet URI, .torrent file path, or info hash. */
  add(torrentId: string): void {
    const id = torrentId.trim();
    if (!id) return;

    try {
      const torrent = this.client.add(id, { path: this.downloadPath });
      this.wireTorrent(torrent);
    } catch (err) {
      this.emit('notice', `Failed to add torrent: ${errorMessage(err)}`);
    }
  }

  private wireTorrent(torrent: Torrent): void {
    torrent.on('error', (err: unknown) => {
      this.emit('notice', `Torrent error: ${errorMessage(err)}`);
    });
    torrent.on('ready', () => {
      this.emit('notice', `Added: ${torrent.name}`);
    });
    torrent.on('done', () => {
      this.emit('done', torrent.name);
      this.emit('notice', `Completed: ${torrent.name}`);
    });
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
      torrent.resume();
      this.pausedHashes.delete(infoHash);
      this.emit('notice', `Resumed: ${torrent.name}`);
      return false;
    }
    torrent.pause();
    this.pausedHashes.add(infoHash);
    this.emit('notice', `Paused: ${torrent.name}`);
    return true;
  }

  /** Remove a torrent and delete its partial data from disk. */
  remove(infoHash: string): void {
    const torrent = this.find(infoHash);
    if (!torrent) return;
    const name = torrent.name;
    this.pausedHashes.delete(infoHash);
    this.client.remove(infoHash, { destroyStore: true }, (err?: Error | string) => {
      if (err) this.emit('notice', `Failed to remove: ${errorMessage(err)}`);
      else this.emit('notice', `Removed: ${name || infoHash}`);
    });
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
