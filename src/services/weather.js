// Mock weather service.
// Deterministic: conditions depend on the zone id and the current "weather epoch"
// (changes every 5 minutes), so demos are reproducible within a run.
//
// Rules of the simulated sky:
//   windKmh > 45  -> drones cannot fly in that zone (NO_FLY)
//   rain === "heavy" -> drones cannot fly in that zone (NO_FLY)

const RAIN_LEVELS = ["none", "light", "heavy"];

function epoch(now = Date.now()) {
  return Math.floor(now / (5 * 60 * 1000));
}

// Cheap deterministic hash so every zone gets stable-but-different weather.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Get current weather for a zone.
 * @param {string} zoneId
 * @returns {{ zoneId: string, windKmh: number, rain: string, noFly: boolean }}
 */
export function getWeather(zoneId, now = Date.now()) {
  const seed = hash(zoneId) + epoch(now);
  const windKmh = seed % 60;                       // 0..59
  const rain = RAIN_LEVELS[seed % RAIN_LEVELS.length];
  const noFly = windKmh > 45 || rain === "heavy";
  return { zoneId, windKmh, rain, noFly };
}

/**
 * Get weather for all zones at once.
 * @param {Array<{id: string}>} zones
 */
export function getWeatherMap(zones, now = Date.now()) {
  const map = {};
  for (const zone of zones) {
    map[zone.id] = getWeather(zone.id, now);
  }
  return map;
}
