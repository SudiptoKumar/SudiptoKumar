// Weather / season / day-band behavior rules (lock §9 behavior matrix).
// Pure + deterministic: given a clock, returns the modifiers schedulers and
// actors apply. Never invents weather — it only interprets the clock.
import { clamp } from '../util.mjs';

// Market bustle by band (noon peak, night quiet — lock §9).
const MARKET_BY_BAND = {
  predawn: 0.1, dawn: 0.35, morning: 0.7, noon: 1.0, afternoon: 0.8,
  sunset: 0.55, evening: 0.4, night: 0.12, deepnight: 0.02,
};
// Outdoor work appetite by band.
const OUTDOOR_BY_BAND = {
  predawn: 0.15, dawn: 0.5, morning: 1.0, noon: 1.0, afternoon: 0.95,
  sunset: 0.4, evening: 0.2, night: 0.05, deepnight: 0.0,
};

export function behaviorRules(clock) {
  const { band, weather, season } = clock;
  const marketActivity = clamp((MARKET_BY_BAND[band] ?? 0.5) * (weather === 'storm' ? 0.1 : 1), 0, 1);
  let outdoorFactor = OUTDOOR_BY_BAND[band] ?? 0.5;
  let farmActivity = OUTDOOR_BY_BAND[band] ?? 0.5;

  if (season === 'winter') { farmActivity *= 0.25; outdoorFactor *= 0.6; }
  if (weather === 'rain') { outdoorFactor *= 0.7; farmActivity *= 0.8; }
  if (weather === 'storm') { outdoorFactor = 0.15; farmActivity = 0.1; }
  if (weather === 'snow') { outdoorFactor *= 0.55; farmActivity *= 0.3; }

  return {
    band, weather, season,
    lampsOn: ['sunset', 'evening', 'night', 'deepnight', 'predawn'].includes(band),
    aurora: clock.aurora,
    marketActivity: Math.round(marketActivity * 100) / 100,
    farmActivity: Math.round(clamp(farmActivity, 0, 1) * 100) / 100,
    outdoorFactor: Math.round(clamp(outdoorFactor, 0, 1) * 100) / 100,
    guardMultiplier: clock.nightBand ? 2 : 1, // night doubles patrol (lock §9)
    shelter: weather === 'storm', // storm: citizens shelter, no construction
    constructionAllowed: weather !== 'storm',
    coveredWork: weather === 'rain' || weather === 'snow', // rain: covered work / umbrellas
    cropState: season === 'winter' ? 'fallow'
      : season === 'spring' ? 'planting'
      : season === 'summer' ? 'growing' : 'harvest-ready',
  };
}
