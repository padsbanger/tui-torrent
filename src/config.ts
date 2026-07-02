import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Platform-appropriate config directory for tui-torrent. */
export function configDir(): string {
  if (process.platform === 'win32') {
    const base =
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'tui-torrent');
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'tui-torrent');
}

/** Absolute path to the user config file. */
export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

/**
 * User-editable config. All fields are optional in the file on disk; missing
 * ones fall back to {@link DEFAULT_CONFIG}. Speeds are in KB/s (0 = unlimited),
 * matching the convention used by common torrent clients.
 */
export interface Config {
  /** Default download directory. `~` is expanded to the home directory. */
  downloadPath: string;
  /** Max download speed in KB/s; 0 means unlimited. */
  maxDownloadSpeed: number;
  /** Max upload speed in KB/s; 0 means unlimited. */
  maxUploadSpeed: number;
  /** Max peer connections per torrent. */
  maxConnections: number;
}

export const DEFAULT_CONFIG: Config = {
  downloadPath: path.join(process.cwd(), 'downloads'),
  maxDownloadSpeed: 0,
  maxUploadSpeed: 0,
  maxConnections: 55,
};

/** Expand a leading `~` (or `~/`) to the user's home directory. */
export function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/** Merge a parsed (untrusted) object onto the defaults, coercing/validating. */
export function resolveConfig(raw: unknown): Config {
  const config: Config = { ...DEFAULT_CONFIG };
  if (typeof raw !== 'object' || raw === null) return config;
  const r = raw as Record<string, unknown>;

  if (typeof r.downloadPath === 'string' && r.downloadPath.trim()) {
    config.downloadPath = path.resolve(expandHome(r.downloadPath.trim()));
  }
  config.maxDownloadSpeed = nonNegativeNumber(r.maxDownloadSpeed, config.maxDownloadSpeed);
  config.maxUploadSpeed = nonNegativeNumber(r.maxUploadSpeed, config.maxUploadSpeed);
  if (typeof r.maxConnections === 'number' && r.maxConnections > 0) {
    config.maxConnections = Math.floor(r.maxConnections);
  }
  return config;
}

/**
 * Load and resolve the config file. Never throws: a missing file yields the
 * defaults, and an unreadable/invalid file yields the defaults plus a warning
 * the caller can surface.
 */
export function loadConfig(): { config: Config; warning?: string } {
  const file = configPath();
  if (!fs.existsSync(file)) return { config: { ...DEFAULT_CONFIG } };
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { config: resolveConfig(parsed) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      config: { ...DEFAULT_CONFIG },
      warning: `Could not read ${file}: ${message}. Using defaults.`,
    };
  }
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}
