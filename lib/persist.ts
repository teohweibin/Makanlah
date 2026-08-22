// Non-blocking file persistence for demo runtime data.
//
// Reads are synchronous but only happen ONCE (on first import).
// Writes are fire-and-forget (async) so they never block page renders.

import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = path.join(process.cwd(), 'data', 'runtime');

function ensureDir() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
}

/** Read once on startup — synchronous is fine here (happens once). */
export function readRuntime<T>(filename: string, fallback: T): T {
  try {
    const file = path.join(RUNTIME_DIR, filename);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Fire-and-forget write — never blocks the response. */
export function writeRuntime<T>(filename: string, data: T): void {
  try {
    ensureDir();
    const file = path.join(RUNTIME_DIR, filename);
    // Async write — does not block the calling function
    fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8', () => {});
  } catch {
    // Non-fatal
  }
}

/** Wipe all runtime JSON files (fresh demo reset). */
export function clearRuntime(): void {
  try {
    if (fs.existsSync(RUNTIME_DIR)) {
      const files = fs.readdirSync(RUNTIME_DIR);
      for (const f of files) {
        fs.unlinkSync(path.join(RUNTIME_DIR, f));
      }
    }
  } catch {
    // Non-fatal — on Vercel this is a no-op anyway
  }
}
