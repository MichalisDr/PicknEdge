/* Display-time eligibility of a player. Pure functions; nothing is stored anywhere.
   Thresholds come from manifest.json (generated from data/manual/eligibility.json). Missing data counts as not eligible.
   1) available(): the availability gate, evaluated once per player for every window: he must have played at least
      availability.minGp of his team's last games (the gp of the availability window's view, normally l3).
   2) eligible(): the selected window's own gp, average minutes and PIR thresholds.
   listed(): what the table shows: both, unless "show everyone" is on. */
(function (g) {
  const num = v => typeof v === 'number' && Number.isFinite(v);
  function available(rule, availabilityGp) {
    const a = rule && rule.availability;
    return !a || (num(availabilityGp) && availabilityGp >= a.minGp);
  }
  function eligible(rule, windowName, stats) {
    const t = rule && rule.windows && rule.windows[windowName];
    if (!t || !stats) return false;
    const ok = (v, min) => num(v) && v >= min;
    return ok(stats.gp, t.minGp) && ok(stats.min, t.minMin) && ok(stats.pir, t.minPir);
  }
  const listed = (rule, windowName, stats, availabilityGp, showAll = false) => showAll || (available(rule, availabilityGp) && eligible(rule, windowName, stats));
  g.PicknEdgeEligibility = { available, eligible, listed };
  if (typeof module !== 'undefined' && module.exports) module.exports = { available, eligible, listed };
})(typeof globalThis !== 'undefined' ? globalThis : this);
