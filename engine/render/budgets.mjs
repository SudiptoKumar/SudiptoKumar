// budgets.mjs — asset budget enforcement (lock §13, spec §09.15).
// Hard ceiling 600 KiB: over-budget asset fails to the safe fallback.
// Design target 450 KiB (grand-mobile 200 KiB): over-target is kept but
// reported so tests/CI can catch drift. Enforced in code, not prose.
import { BUDGETS } from '../world/constants.mjs';
import { fallbackAsset } from './fallback.mjs';

export const kiB = (n) => n / 1024;

export function budgetFor(kind) {
  return {
    hard: BUDGETS.svgHardCeilingKiB * 1024,
    target: (kind === 'grand-mobile' ? BUDGETS.grandWorldMobileKiB : BUDGETS.svgDesignTargetKiB) * 1024,
    kind,
  };
}

/**
 * @returns { svg, bytes, problems[], usedFallback }
 * Over the hard ceiling the asset is replaced by the fallback plaque;
 * over the design target it is kept and the problem is reported.
 */
export function enforceBudget(key, svg, { kind = 'svg' } = {}) {
  const { hard, target } = budgetFor(kind);
  const bytes = Buffer.byteLength(svg);
  const problems = [];
  if (bytes > hard) {
    problems.push(`HARD CEILING: ${key} is ${kiB(bytes).toFixed(1)} KiB > ${BUDGETS.svgHardCeilingKiB} KiB — replaced by fallback`);
    return { svg: fallbackAsset(key, 'asset exceeded size budget'), bytes, problems, usedFallback: true };
  }
  if (bytes > target) {
    problems.push(`design target: ${key} is ${kiB(bytes).toFixed(1)} KiB > ${kiB(target).toFixed(0)} KiB`);
  }
  return { svg, bytes, problems, usedFallback: false };
}
