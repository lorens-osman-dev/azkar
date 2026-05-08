/**
 * core/logger.ts — Colorized Logger
 *
 * Responsibility:
 * - Provide consistent, grep-friendly logging with ANSI colors
 * - Format stack traces so `journalctl | grep Azkar` catches every line
 *
 * Does NOT:
 * - Access any GNOME APIs
 * - Hold any state
 */

// ─── Extension Identification ───
export const EXTENSION_NAME = 'Azkar';

// ─── ANSI Color Constants ────────────────────────────────────────────────────

const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Dynamically inject the EXTENSION_NAME to ensure terminal grep filters catch standard logs
const TAG = `${CYAN}[${EXTENSION_NAME}]${RESET}`;
const ETAG = `${RED}[${EXTENSION_NAME} ERROR]${RESET}`;

// ─── Public API ──────────────────────────────────────────────────────────────

export const Logger = {
  /**
   * Log an informational message.
   * Visible in: journalctl -f -o cat /usr/bin/gnome-shell | grep Azkar
   */
  info(msg: string): void {
    print(`${TAG} ${msg}`);
  },

  /**
   * Log an error with a full stack trace.
   * Every line is prefixed with [Azkar] so grep keeps it.
   */
  error(context: string, error?: unknown): void {
    let output = `${ETAG} ${context}`;

    if (error) {
      const err = error as { stack?: string; message?: string };
      const lines = err.stack
        ? err.stack.split('\n').filter(l => l.trim() !== '')
        : [`${err.message ?? error}`];

      for (const line of lines) {
        // Dynamically inject the EXTENSION_NAME into stack traces to prevent the Make target's grep 
        // from aggressively filtering out critical multi-line error details.
        output += `\n${YELLOW}[${EXTENSION_NAME}]  ↳ ${line.trim()}${RESET}`;
      }
    }

    printerr(output);
  },
};