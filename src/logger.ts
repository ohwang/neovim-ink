import { createWriteStream, type WriteStream } from "node:fs";
import { join } from "node:path";

let stream: WriteStream | null = null;
let enabled = false;

export function initLogger(logDir?: string): void {
  const dir = logDir ?? process.env["NEOVIM_INK_LOG_DIR"] ?? "/tmp";
  const path = join(dir, "neovim-ink.log");
  stream = createWriteStream(path, { flags: "w" });
  enabled = true;
  log("logger", `Logging to ${path}`);
}

export function log(category: string, message: string, data?: unknown): void {
  if (!enabled || !stream) return;
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  let line = `[${ts}] [${category}] ${message}`;
  if (data !== undefined) {
    try {
      line += " " + JSON.stringify(data);
    } catch {
      line += " [unserializable]";
    }
  }
  stream.write(line + "\n");
}

export function closeLogger(): void {
  stream?.end();
  stream = null;
  enabled = false;
}
