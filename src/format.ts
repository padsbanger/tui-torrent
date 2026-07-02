/** Formatting helpers for displaying torrent stats in the TUI. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** Human-readable byte size, e.g. 1536 -> "1.50 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / Math.pow(1024, exp);
  const decimals = exp === 0 ? 0 : 2;
  return `${value.toFixed(decimals)} ${UNITS[exp]}`;
}

/** Transfer speed, e.g. "1.50 MB/s". */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** Fraction (0..1) as a percentage string, e.g. 0.4231 -> "42.3%". */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) return '0.0%';
  return `${Math.min(fraction * 100, 100).toFixed(1)}%`;
}

/** Seconds remaining as compact time, e.g. 3725 -> "1h 2m". Infinity -> "∞". */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '∞';
  if (seconds === 0) return 'done';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Build a unicode progress bar of the given width for a 0..1 fraction. */
export function progressBar(fraction: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const filled = Math.round(clamped * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/** Rolling download/upload speed samples (bytes/s) used by the sparkline. */
export interface SpeedHistory {
  down: number[];
  up: number[];
}

const SPARK_TICKS = '▁▂▃▄▅▆▇█';

/**
 * Render a series of values as a unicode sparkline of the given width. The most
 * recent `width` samples are shown, auto-scaled to the window's peak, and
 * left-padded with spaces when there are fewer samples than the width.
 */
export function sparkline(values: number[], width: number): string {
  if (width <= 0) return '';
  const recent = values.slice(-width);
  if (recent.length === 0) return ' '.repeat(width);
  const max = Math.max(...recent);
  const bars = recent
    .map((value) => {
      if (max <= 0) return SPARK_TICKS[0];
      const ratio = Math.max(0, Math.min(1, value / max));
      const index = Math.round(ratio * (SPARK_TICKS.length - 1));
      return SPARK_TICKS[index];
    })
    .join('');
  return bars.padStart(width, ' ');
}
