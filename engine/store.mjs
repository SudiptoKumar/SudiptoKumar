// The "database": small JSON files in data/. We only write a file when its content changed.
import fs from 'node:fs';
import path from 'node:path';

export const EMPTY = {
  achievements: () => ({ version: 1, unlocked: {} }),
  events: () => ({ version: 1, events: [], raids: [] }),
  visitors: () => ({ version: 1, next: 1, flags: [], processed: {} }),
  history: () => ({ version: 1, points: [] }),
  avatars: () => ({ version: 1, items: {} }),
};

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
export function loadStore(root) {
  const d = path.join(root, 'data');
  const s = {};
  for (const k of Object.keys(EMPTY)) s[k] = { ...EMPTY[k](), ...readJson(path.join(d, `${k}.json`), {}) };
  s.prev = readJson(path.join(d, 'world-state.json'), null);
  if (s.prev && !s.prev.level) s.prev = null;
  return s;
}
export function cloneStore(store) {
  return JSON.parse(JSON.stringify({ ...store }));
}
export function writeIfChanged(file, content) {
  try { if (fs.readFileSync(file, 'utf8') === content) return false; } catch { /* new file */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}
export const toJson = (v) => JSON.stringify(v, null, 2) + '\n';
export function saveStore(root, store) {
  const changed = [];
  for (const k of Object.keys(EMPTY)) if (writeIfChanged(path.join(root, 'data', `${k}.json`), toJson(store[k]))) changed.push(`data/${k}.json`);
  return changed;
}
