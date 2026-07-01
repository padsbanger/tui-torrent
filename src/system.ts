import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Open a file or directory with the OS default handler / file manager.
 * Resolves once the helper process is spawned (some launchers, notably
 * Windows Explorer, exit non-zero even on success, so we don't wait on the
 * exit code — only a spawn failure is treated as an error).
 */
export function openPath(target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { command, args } =
      process.platform === 'win32'
        ? { command: 'explorer.exe', args: [target] }
        : process.platform === 'darwin'
          ? { command: 'open', args: [target] }
          : { command: 'xdg-open', args: [target] };

    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

/** Copy text to the system clipboard using the platform's CLI utility. */
export async function copyToClipboard(text: string): Promise<void> {
  const candidates: Array<[string, string[]]> =
    process.platform === 'win32'
      ? [['clip', []]]
      : process.platform === 'darwin'
        ? [['pbcopy', []]]
        : [
            ['wl-copy', []],
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
          ];

  let lastError: unknown;
  for (const [command, args] of candidates) {
    try {
      await pipeToCommand(command, args, text);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No clipboard utility available');
}

/** Spawn a command and feed `text` to its stdin, resolving on exit code 0. */
function pipeToCommand(command: string, args: string[], text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    // Ignore EPIPE if the helper closes stdin early.
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  });
}
