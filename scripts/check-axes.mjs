/* Prints the ends and the step of every gallery chart's axes, computed from the data in site/data. For looking, by hand: node scripts/check-axes.mjs
   It checks nothing and is run by no test, CI or data job: a new extreme value just moves an end (the rule is in site/fantasy/gallery/scale.js, the steps in axes.js). */
import { useRealData } from '../tests/helpers/site-data.mjs';

useRealData();
const { galleryHtml } = await import('../site/fantasy/gallery/gallery.js');
const { CHARTS } = await import('../site/fantasy/gallery/charts.js');

const un = s => s.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const line = (chart, s, id) => `${chart.padEnd(28)}${id.padEnd(14)}${`${s.lo} to ${s.hi}`.padEnd(14)}step ${s.step}`;
for (const kind of ['teams', 'players']) for (const view of ['profile', 'shooting']) {
  const html = await galleryHtml(kind, view, { win: 'season', view });   // the axes are the same in every window
  for (const m of html.matchAll(/data-chart-id="([^"]+)"[\s\S]*?data-plot="([^"]+)"/g)) {
    const chart = CHARTS.find(c => c.id === m[1]), model = JSON.parse(un(m[2]));
    console.log(line(chart.id, model.sx, chart.x)); console.log(line('', model.sy, chart.y));
  }
}
