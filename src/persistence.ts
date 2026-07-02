import fs from 'node:fs';
import path from 'node:path';
import { configDir } from './config.js';

/** One torrent's restorable state. Progress is not stored — WebTorrent
 *  re-verifies the existing data in `path` when the torrent is re-added. */
export interface PersistedTorrent {
  /** Info hash, used to locate the saved .torrent metadata for instant resume. */
  infoHash?: string;
  /** A magnet URI (or info hash) used to re-add the torrent if metadata is absent. */
  torrentId: string;
  /** Download directory, so partial data is found and resumed. */
  path: string;
  paused: boolean;
}

/** Absolute path to the persisted session file. */
export function statePath(): string {
  return path.join(configDir(), 'state.json');
}

/** Directory holding saved .torrent metadata, keyed by info hash. */
function metadataDir(): string {
  return path.join(configDir(), 'metadata');
}

/** Absolute path to a torrent's saved .torrent metadata file. */
export function metadataPath(infoHash: string): string {
  return path.join(metadataDir(), `${infoHash}.torrent`);
}

/** Load the saved session, returning [] if absent or unreadable. */
export function loadState(): PersistedTorrent[] {
  const file = statePath();
  if (!fs.existsSync(file)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPersistedTorrent);
}

/** Atomically write the session to disk, creating the config dir if needed. */
export function saveState(torrents: PersistedTorrent[]): void {
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(torrents, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/** Persist a torrent's .torrent metadata so it can be resumed without re-fetching it. */
export function saveMetadata(infoHash: string, torrentFile: Uint8Array): void {
  const file = metadataPath(infoHash);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, torrentFile);
  fs.renameSync(tmp, file);
}

/** Load saved .torrent metadata for a torrent, or undefined if absent/unreadable. */
export function loadMetadata(infoHash: string): Buffer | undefined {
  try {
    const file = metadataPath(infoHash);
    return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
  } catch {
    return undefined;
  }
}

/** Remove a torrent's saved .torrent metadata, if any. */
export function deleteMetadata(infoHash: string): void {
  try {
    fs.rmSync(metadataPath(infoHash), { force: true });
  } catch {
    // ignore
  }
}

/** Extract the BTIH info hash from a magnet URI, if present. */
export function infoHashFromMagnet(torrentId: string): string | undefined {
  const match = /xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/.exec(torrentId);
  return match ? match[1].toLowerCase() : undefined;
}

function isPersistedTorrent(value: unknown): value is PersistedTorrent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.torrentId === 'string' &&
    typeof v.path === 'string' &&
    typeof v.paused === 'boolean'
  );
}
