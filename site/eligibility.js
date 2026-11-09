/* Display-time eligibility of a player in the selected window. Pure function; nothing is stored anywhere.
   Thresholds come from manifest.json (generated from data/manual/eligibility.json); stats are the window's own
   gp, min and pir values from the player view. Missing data counts as not eligible. */
(function (g) {
  function eligible(rule, windowName, stats) {
    const t = rule && rule.windows && rule.windows[windowName];
    if (!t || !stats) return false;
    const ok = (v, min) => typeof v === 'number' && Number.isFinite(v) && v >= min;
    return ok(stats.gp, t.minGp) && ok(stats.min, t.minMin) && ok(stats.pir, t.minPir);
  }
  g.PicknEdgeEligibility = { eligible };
  if (typeof module !== 'undefined' && module.exports) module.exports = { eligible };
})(typeof globalThis !== 'undefined' ? globalThis : this);
