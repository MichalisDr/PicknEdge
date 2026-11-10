// Shot-zone model: ONE definition (12 zones, 6 sub-areas, 3 areas) used by the build to classify every shot.
// Units are the EuroLeague shots feed's: centimetres, hoop at (0,0), +y towards midcourt, baseline at y = -157.5.
// theta = atan2(y, x) in degrees. Lane 4.9 m (|x| <= 245), free-throw line y = 422.5, arc 6.75 m, corner line x = 660,
// J = height where the arc meets the corner line. Map choices (not official dimensions): RIM_R, RIM_STRIP_Y, DIAG_DEG.
const BASELINE = -157.5, LANE = 245, FT = 422.5, ARC = 675, CORNER_X = 660;
const J = Math.sqrt(ARC * ARC - CORNER_X * CORNER_X);
const B_DEG = Math.atan2(J, CORNER_X) * 180 / Math.PI;      // ray from the hoop to the arc/corner junction: Baseline below it, Mid above it
const RIM_R = 130, RIM_STRIP_Y = -37.5;                      // At the rim: half disc in front of the hoop plus the strip behind it
const DIAG_DEG = 67;                                         // Arc and Mid are split right < 67, centre 67..113, left > 113 degrees

export const ZONES = [
  { key: 'rim', name: 'At the rim', sub: 'rim' }, { key: 'paint', name: 'Rest of paint', sub: 'paint' },
  { key: 'midL', name: 'Mid left', sub: 'mid' }, { key: 'midC', name: 'Mid center', sub: 'mid' }, { key: 'midR', name: 'Mid right', sub: 'mid' },
  { key: 'baseL', name: 'Baseline left', sub: 'base' }, { key: 'baseR', name: 'Baseline right', sub: 'base' },
  { key: 'arcL', name: 'Arc left', sub: 'arc' }, { key: 'arcC', name: 'Arc center', sub: 'arc' }, { key: 'arcR', name: 'Arc right', sub: 'arc' },
  { key: 'cornerL', name: 'Corner left', sub: 'corner' }, { key: 'cornerR', name: 'Corner right', sub: 'corner' },
];
export const SUBS = [
  { key: 'rim', name: 'At the rim', main: 'paint' }, { key: 'paint', name: 'Rest of paint', main: 'paint' }, { key: 'mid', name: 'Mid-range', main: 'mid' },
  { key: 'base', name: 'Baseline', main: 'mid' }, { key: 'arc', name: 'Arc 3', main: '3p' }, { key: 'corner', name: 'Corner 3', main: '3p' },
];
export const MAINS = [{ key: '3p', name: '3P' }, { key: 'mid', name: 'Mid' }, { key: 'paint', name: 'Paint' }];
export const zonesOfSub = s => ZONES.filter(z => z.sub === s).map(z => z.key);
export const zonesOfMain = m => ZONES.filter(z => SUBS.find(s => s.key === z.sub).main === m).map(z => z.key);

const inRim = (x, y) => y >= 0 ? x * x + y * y <= RIM_R * RIM_R : y >= RIM_STRIP_Y && Math.abs(x) <= RIM_R;
const inPaint = (x, y) => Math.abs(x) <= LANE && y >= BASELINE && y <= FT;

/** Zone key of a field-goal attempt; `three` comes from the official event type, the position gives the zone. null = unusable coordinates. */
export function classify(x, y, three) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const th = Math.atan2(y, x) * 180 / Math.PI;
  if (three) {
    if (y <= J) return x < 0 ? 'cornerL' : 'cornerR';
    return th < DIAG_DEG ? 'arcR' : th <= 180 - DIAG_DEG ? 'arcC' : 'arcL';
  }
  if (inRim(x, y)) return 'rim';
  if (inPaint(x, y)) return 'paint';
  if (y < 0) return x < 0 ? 'baseL' : 'baseR';
  if (th < B_DEG) return 'baseR';
  if (th < DIAG_DEG) return 'midR';
  if (th <= 180 - DIAG_DEG) return 'midC';
  if (th <= 180 - B_DEG) return 'midL';
  return 'baseL';
}
