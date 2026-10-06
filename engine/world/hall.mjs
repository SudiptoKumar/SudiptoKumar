// TRUE V2 trophy hall model (TRUE V2 §14). Achievements are physical trophies
// in one hall. The hall is driven by the existing achievement system —
// this module only shapes that data into world objects.

/** Build the one trophy-hall model. Pure and deterministic. */
export function buildHall(S) {
  const list = S.achievements?.list || [];
  const trophies = list.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    secret: !!a.secret,
    major: !!a.major,
    unlocked: !!a.unlocked,
    isNew: !!a.isNew,
  }));
  return {
    anchor: 'shrine',   // the hall is entered through the trophy shrine in the central kingdom
    trophies,
    unlocked: trophies.filter((t) => t.unlocked).length,
    total: trophies.length,
    lockedSecrets: trophies.filter((t) => t.secret && !t.unlocked).length,
  };
}
