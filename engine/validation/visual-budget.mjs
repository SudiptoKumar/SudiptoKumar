// Visual/asset budget enforcement (lock §13; spec §09.15).
// Budgets are enforced in code, not prose.
import { BUDGETS } from '../world/constants.mjs';

export const kiB = (n) => n / 1024;

/**
 * Check a generated SVG's byte size against the lock budgets.
 * @param {string|Buffer} svg
 * @param {object} opts {kind: 'svg'|'grand-mobile'}
 * @returns {string[]} problems (empty when within budget)
 */
export function checkSvgBudget(svg, { kind = 'svg' } = {}) {
  const bytes = Buffer.byteLength(svg);
  const problems = [];
  const hard = BUDGETS.svgHardCeilingKiB * 1024;
  const target = (kind === 'grand-mobile' ? BUDGETS.grandWorldMobileKiB : BUDGETS.svgDesignTargetKiB) * 1024;
  if (bytes > hard) problems.push(`svg exceeds hard ceiling: ${kiB(bytes).toFixed(1)} KiB > ${BUDGETS.svgHardCeilingKiB} KiB`);
  else if (bytes > target) problems.push(`svg exceeds design target: ${kiB(bytes).toFixed(1)} KiB > ${kind === 'grand-mobile' ? BUDGETS.grandWorldMobileKiB : BUDGETS.svgDesignTargetKiB} KiB`);
  return problems;
}

/** Check total README generated content against the 6 MiB internal target. */
export function checkReadmeBudget(totalBytes) {
  const cap = BUDGETS.readmeTotalMiB * 1024 * 1024;
  return totalBytes > cap
    ? [`readme content exceeds budget: ${(totalBytes / 1048576).toFixed(2)} MiB > ${BUDGETS.readmeTotalMiB} MiB`]
    : [];
}

export const budgets = () => ({ ...BUDGETS });
