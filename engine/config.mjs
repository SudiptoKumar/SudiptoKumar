// Kingdom config loader (adapted from prior config.mjs).
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULTS = {
  owner: '',
  displayName: 'Kingdom',
  worldSeed: 'kingdom',
  timezone: 'UTC',
  hemisphere: 'northern',
  archetypeOverrides: {}, // repoKey -> archetype
  bannedWords: [],
  links: {},
};

export function loadConfig(root = process.cwd()) {
  const file = path.join(root, 'kingdom.config.json');
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* defaults */ }
  return { ...DEFAULTS, ...raw };
}

export const repoUrl = (cfg, repo) => `https://github.com/${cfg.owner}/${repo}`;
export const rawUrl = (cfg, branch, file) =>
  `https://raw.githubusercontent.com/${cfg.owner}/${cfg.owner}/${branch}/${file}`;
