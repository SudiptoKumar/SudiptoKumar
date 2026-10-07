// Persistence helpers (adapted from prior store.mjs).
// writeIfChanged: only touch a file when its content changed (avoids churn).
import fs from 'node:fs';
import path from 'node:path';

export const toJson = (v) => `${JSON.stringify(v, null, 2)}\n`;

/** Write file only when content differs. Returns true when it wrote. */
export function writeIfChanged(file, content) {
  try {
    if (fs.readFileSync(file, 'utf8') === content) return false;
  } catch { /* new file */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

export function loadJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function saveJson(file, value) {
  return writeIfChanged(file, toJson(value));
}
