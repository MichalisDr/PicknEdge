/* Pick n Edge shell: routes, the sidebar and which page is mounted into #content. */
import { mount as mountFantasyTables } from '../fantasy/tables/table-page.js';
import { mount as mountMyTeam } from '../fantasy/my-team/team-page.js';
import { mount as mountBettingTables } from '../betting/table-page.js';
import { overview, manual, saved } from '../betting/research.js';
import { Data } from '../core/data.js';
import { showCoverage } from './coverage.js';

const content = document.querySelector('#content');

/* 'schedule' (From the schedule) is hidden until the Betting redesign: the old route falls back to the overview. */
const ROUTES = ['fantasy', 'fantasy/players', 'fantasy/my-team', 'data', 'betting', 'manual', 'saved'];
const LINKS = {
  fantasy: [['fantasy/players', 'Players'], ['fantasy', 'Teams']],
  betting: [['betting', 'Overview'], ['manual', 'Manual analysis'], ['saved', 'Saved analyses'], ['data', 'Betting statistics']],
};
/* A second sidebar group under WORKSPACE (Fantasy only). */
const FEATURES = { fantasy: [['fantasy/my-team', 'My Team']] };

export function render() {
  let current = location.hash.slice(1) || 'fantasy';
  if (current === 'schedule') current = 'betting';
  if (!ROUTES.includes(current)) current = 'fantasy';
  const area = current.startsWith('fantasy') ? 'fantasy' : 'betting';
  document.body.dataset.area = area;
  const coverage = document.querySelector('[data-part="app.top-bar.coverage"]');
  if (coverage) { showCoverage(coverage, area, null); if (area === 'fantasy') Data.manifest().then(m => { if (document.body.dataset.area === area) showCoverage(coverage, area, m); }).catch(() => {}); }   // the table page announces its own loading and errors
  document.querySelectorAll('[data-area]').forEach(a => a.classList.toggle('active', a.dataset.area === area));
  const links = list => list.map(([id, t]) => `<a href="#${id}" class="${current === id ? 'active' : ''}" ${current === id ? 'aria-current="page"' : ''}>${t}</a>`).join('');
  document.querySelector('#sidebar').innerHTML = '<small>WORKSPACE</small>' + links(LINKS[area])
    + (FEATURES[area] ? '<div data-part="app.sidebar.group"><small>FEATURES</small></div>' + links(FEATURES[area]) : '')
    + (area === 'fantasy' ? '' : '<div class="aside-note">One database.<br>Two ways to analyse.<br><br>From observation to evidence.</div>');
  if (current === 'fantasy/my-team') return mountMyTeam(content);
  if (current.startsWith('fantasy')) return mountFantasyTables(content, current === 'fantasy/players' ? 'players' : 'teams');
  if (current === 'data') return mountBettingTables(content);
  if (current === 'betting') return overview(content);
  if (current === 'manual') return manual(content);
  return saved(content);
}
