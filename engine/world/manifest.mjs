// RULE D support: every picture carries a manifest of what it drew (written by the shared pipeline), and these functions compare manifests.
// A manifest is { v, cam, lod, sig, g: { season, phase, weather, light, tier, event, hero }, o: { id: [x, y, state, lod, markupHash] } }.

export function readManifest(svg) {
  const m = /<!--kingdom-world (.*?)-->/s.exec(svg || '');
  if (!m) return null;
  return JSON.parse(m[1].replace(/-\u2010/g, '--'));
}

/**
 * Compare the manifests of several pictures of the SAME world state. Returns a list of problems (empty = one consistent kingdom).
 *  - the world signature and every global value (season, phase, weather, lighting, power tier, event, hero) must be identical,
 *  - an object that appears in two pictures must be at the same place with the same state,
 *  - and must be the same drawing whenever both pictures drew it at the same level of detail.
 */
export function consistencyProblems(list) {
  const problems = [];
  const first = list[0];
  for (const { name, m } of list) {
    if (m.sig !== first.m.sig) problems.push(`${name}: world signature ${m.sig} differs from ${first.name} ${first.m.sig}`);
    for (const k of Object.keys(first.m.g)) if (m.g[k] !== first.m.g[k]) problems.push(`${name}: ${k} is "${m.g[k]}" but ${first.name} says "${first.m.g[k]}"`);
  }
  const seen = new Map();
  for (const { name, m } of list) {
    for (const [id, [x, y, st, lod, hash]] of Object.entries(m.o)) {
      const prev = seen.get(id);
      if (!prev) { seen.set(id, { name, x, y, st, lod, hash }); continue; }
      if (prev.x !== x || prev.y !== y) problems.push(`${id}: at ${x},${y} in ${name} but ${prev.x},${prev.y} in ${prev.name}`);
      if (prev.st !== st) problems.push(`${id}: state "${st}" in ${name} but "${prev.st}" in ${prev.name}`);
      if (prev.lod === lod && prev.hash !== hash) problems.push(`${id}: drawn differently in ${name} and ${prev.name} (same level of detail ${lod})`);
    }
  }
  return problems;
}
