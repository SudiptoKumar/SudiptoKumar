// Economy: cart routes + farm cycle.
// Cart routes (spec §07 §15), limited count for performance:
//   warehouse -> project_quarter (materials)
//   farm_entrance -> mill (grain) · mill -> market_square (flour)
//   harbor_docks -> market_square (harbor goods)
//   warehouse -> builder_yard (timber) · market_square -> warehouse (returns)
// Carts shuttle A->B->A on chained legs (continuous, no teleports) and read
// as actors with role 'cart'. Farm state derives from world.farm maturity +
// season (lock §9): winter fallow, spring planting, summer growing,
// autumn harvest-ready -> harvest tasks + farmer pressure.
import { subRng } from '../util.mjs';
import { positionOnItinerary } from './movement.mjs';
import { scheduleFor } from './scheduler.mjs';

export const CART_ROUTES = [
  ['warehouse', 'project_quarter'],
  ['farm_entrance', 'mill'],
  ['mill', 'market_square'],
  ['harbor_docks', 'market_square'],
  ['warehouse', 'builder_yard'],
  ['market_square', 'warehouse'],
];

/** Chained cart shuttle legs (exported for the no-teleport test). */
export function cartItinerary(from, to, seed, id) {
  const r = subRng(seed, 'cart', id);
  const d1 = 6 + Math.floor(r() * 2); // deterministic departure stagger
  return {
    legs: [
      { from, to: from, startH: 0, endH: d1 },
      { from, to, startH: d1, endH: d1 + 4 },
      { from: to, to, startH: d1 + 4, endH: d1 + 6 },
      { from: to, to: from, startH: d1 + 6, endH: d1 + 10 },
      { from, to: from, startH: d1 + 10, endH: 24 },
    ],
  };
}

function farmCycle(world, clock, ctx, rules) {
  const maturity = world.farm?.maturity ?? 'unknown';
  const season = clock.season;
  let cropState = 'unknown';
  let harvestReady = false;
  if (season === 'winter') cropState = 'fallow';
  else if (season === 'spring') cropState = maturity === 'fallow' ? 'fallow' : 'planting';
  else if (season === 'summer') cropState = 'growing';
  else if (season === 'autumn') {
    harvestReady = ['mature', 'harvest'].includes(maturity);
    cropState = harvestReady ? 'harvest-ready' : 'growing';
  }
  const tasks = [];
  if (harvestReady && rules.farmActivity > 0.1) {
    tasks.push({
      id: 'task-harvest-fields',
      type: 'harvest',
      state: 'assigned',
      assignee: 'farmer-elsa',
      plot: 'farms',
      anchor: 'farm_entrance',
      progress: Math.round(subRng(world.seed, 'harvest', clock.dateKey)() * 100) / 100,
    });
  }
  return { cropState, maturity, harvestReady, tasks };
}

/**
 * @returns {{ carts: object[], tasks: object[], farm: object }}
 */
export function economyTick(world, clock, ctx, rules) {
  const seed = world.seed;
  const quiet = clock.nightBand;
  const carts = CART_ROUTES.map(([from, to], i) => {
    const id = `cart-${String(i + 1).padStart(2, '0')}`;
    const pos = positionOnItinerary(cartItinerary(from, to, seed, id), clock.timeOfDay, 'e');
    const sched = scheduleFor('cart', clock, { ...ctx, rules });
    const hauling = pos.moving && !quiet;
    return {
      id, role: 'cart',
      homeAnchor: from, workAnchor: to,
      routeId: pos.routeId,
      state: quiet ? 'idle' : sched.state,
      x: Math.round(pos.x), y: Math.round(pos.y),
      facing: pos.facing,
      task: quiet ? 'parked for the night' : (hauling ? `hauling ${from} -> ${to}` : `loading at ${pos.leg.to}`),
      progress: pos.progress,
      priority: 10,
      seed: `${id}:${seed}`,
      cargo: `${from.split('_')[0]} goods`,
    };
  });
  const farm = farmCycle(world, clock, ctx, rules);
  return { carts, tasks: farm.tasks, farm };
}
