// Hand-rolled validator for the required-field subset of
// spec/schemas/world-v3.schema.json (no external deps).
// Returns a list of error strings; empty => valid.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';

/**
 * Validate a World JSON object against the schema's required fields.
 * @param {object} world
 * @returns {string[]} errors
 */
export function validateWorldSchema(world) {
  const errors = [];
  const req = (obj, field, where, type) => {
    if (obj[field] === undefined || obj[field] === null) {
      errors.push(`${where}: missing required field '${field}'`);
      return false;
    }
    if (type === 'string' && !isStr(obj[field])) errors.push(`${where}: '${field}' must be a string`);
    if (type === 'array' && !Array.isArray(obj[field])) errors.push(`${where}: '${field}' must be an array`);
    if (type === 'object' && !isObj(obj[field])) errors.push(`${where}: '${field}' must be an object`);
    return true;
  };

  if (!isObj(world)) return ['world: must be an object'];
  for (const f of ['version', 'seed', 'signature']) req(world, f, 'world', 'string');
  for (const f of ['map', 'districts', 'roads', 'buildings', 'actors', 'events', 'time']) {
    if (world[f] === undefined || world[f] === null) errors.push(`world: missing required field '${f}'`);
  }
  // 'hero' is required as a field but may be explicitly null (graceful absence, lock §6)
  if (!('hero' in world)) errors.push("world: missing required field 'hero'");
  if (world.signature !== undefined && !(isStr(world.signature) && world.signature.length >= 1)) {
    errors.push("world: 'signature' must be a non-empty string");
  }

  if (isObj(world.map)) {
    if (!Number.isInteger(world.map.width) || world.map.width < 1) errors.push("world.map: 'width' must be a positive integer");
    if (!Number.isInteger(world.map.height) || world.map.height < 1) errors.push("world.map: 'height' must be a positive integer");
  }
  if (Array.isArray(world.districts)) {
    world.districts.forEach((d, i) => {
      if (!isObj(d) || !isStr(d.id)) errors.push(`world.districts[${i}]: 'id' must be a string`);
    });
  }
  if (Array.isArray(world.roads)) {
    // schema models roads as an edge list; we also accept the {nodes, edges} form
    world.roads.forEach((e, i) => {
      if (!isObj(e)) { errors.push(`world.roads[${i}]: must be an object`); return; }
      for (const f of ['id', 'from', 'to']) if (!isStr(e[f])) errors.push(`world.roads[${i}]: '${f}' must be a string`);
    });
  } else if (isObj(world.roads)) {
    for (const e of world.roads.edges ?? []) {
      for (const f of ['id', 'from', 'to']) if (!isStr(e?.[f])) errors.push(`world.roads.edges[]: '${f}' must be a string`);
    }
  }
  if (Array.isArray(world.buildings)) {
    world.buildings.forEach((b, i) => {
      if (!isObj(b)) { errors.push(`world.buildings[${i}]: must be an object`); return; }
      if (!isStr(b.id)) errors.push(`world.buildings[${i}]: 'id' must be a string`);
      if (!isStr(b.archetype)) errors.push(`world.buildings[${i}]: 'archetype' must be a string`);
      if (!isStr(b.district)) errors.push(`world.buildings[${i}]: 'district' must be a string`);
      if (!isNum(b.x)) errors.push(`world.buildings[${i}]: 'x' must be a number`);
      if (!isNum(b.y)) errors.push(`world.buildings[${i}]: 'y' must be a number`);
    });
  }
  if (Array.isArray(world.actors)) {
    world.actors.forEach((a, i) => {
      if (!isObj(a)) { errors.push(`world.actors[${i}]: must be an object`); return; }
      if (!isStr(a.id)) errors.push(`world.actors[${i}]: 'id' must be a string`);
      if (!isStr(a.role)) errors.push(`world.actors[${i}]: 'role' must be a string`);
      if (!isStr(a.state)) errors.push(`world.actors[${i}]: 'state' must be a string`);
      if (!isNum(a.x)) errors.push(`world.actors[${i}]: 'x' must be a number`);
      if (!isNum(a.y)) errors.push(`world.actors[${i}]: 'y' must be a number`);
    });
  }
  if (world.hero !== null && world.hero !== undefined) {
    if (!isObj(world.hero)) errors.push('world.hero: must be an object or null');
    else {
      if (!isNum(world.hero.x)) errors.push("world.hero: 'x' must be a number");
      if (!isNum(world.hero.y)) errors.push("world.hero: 'y' must be a number");
      if (!isStr(world.hero.state)) errors.push("world.hero: 'state' must be a string");
    }
  }
  if (Array.isArray(world.events)) {
    world.events.forEach((e, i) => {
      if (!isObj(e)) { errors.push(`world.events[${i}]: must be an object`); return; }
      for (const f of ['id', 'type', 'phase']) if (!isStr(e[f])) errors.push(`world.events[${i}]: '${f}' must be a string`);
    });
  }
  if (isObj(world.time)) {
    if (!isStr(world.time.phase)) errors.push("world.time: 'phase' must be a string");
    if (!isStr(world.time.season)) errors.push("world.time: 'season' must be a string");
  }
  return errors;
}

/** Validate a simulation snapshot against schemas/simulation-v3.schema.json (required subset). */
export function validateSimulationSchema(snap) {
  const errors = [];
  if (!isObj(snap)) return ['snapshot: must be an object'];
  if (!isStr(snap.version)) errors.push("snapshot: 'version' must be a string");
  if (!isStr(snap.timeBucket)) errors.push("snapshot: 'timeBucket' must be a string");
  if (!Array.isArray(snap.actors)) errors.push("snapshot: 'actors' must be an array");
  else snap.actors.forEach((a, i) => {
    if (!isObj(a)) { errors.push(`snapshot.actors[${i}]: must be an object`); return; }
    for (const f of ['id', 'state']) if (!isStr(a[f])) errors.push(`snapshot.actors[${i}]: '${f}' must be a string`);
    for (const f of ['x', 'y']) if (!isNum(a[f])) errors.push(`snapshot.actors[${i}]: '${f}' must be a number`);
  });
  if (!Array.isArray(snap.tasks)) errors.push("snapshot: 'tasks' must be an array");
  else snap.tasks.forEach((t, i) => {
    for (const f of ['id', 'type', 'state']) if (!isStr(t?.[f])) errors.push(`snapshot.tasks[${i}]: '${f}' must be a string`);
  });
  if (!isObj(snap.war) || !isStr(snap.war.state)) errors.push("snapshot.war: 'state' must be a string");
  if (!Array.isArray(snap.effects)) errors.push("snapshot: 'effects' must be an array");
  else snap.effects.forEach((e, i) => {
    if (!isStr(e?.type)) errors.push(`snapshot.effects[${i}]: 'type' must be a string`);
  });
  return errors;
}

export const worldSchemaIsValid = (world) => validateWorldSchema(world).length === 0;
