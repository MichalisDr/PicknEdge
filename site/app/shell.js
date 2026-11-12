/* Pick n Edge shell: routes, the sidebar and which page is mounted into #content. */
import { mount as mountFantasyTables } from '../fantasy/tables/table-page.js';
import { mount as mountBettingTables } from '../betting/table-page.js';
import { overview, manual, saved } from '../betting/research.js';

const content = document.querySelector('#content');

/* 'schedule' (From the schedule) is hidden until the Betting redesign: the old route falls back to the overview. */
const ROUTES = ['fantasy', 'fantasy/players', 'data', 'betting', 'manual', 'saved'];
const LINKS = {
  fantasy: [['fantasy/players', 'Players'], ['fantasy', 'Teams']],
  betting: [['betting', 'Overview'], ['manual', 'Manual analysis'], ['saved', 'Saved analyses'], ['data', 'Betting statistics']],
};

export function render() {
  let current = location.hash.slice(1) || 'fantasy';
  if (current === 'schedule') current = 'betting';
  if (!ROUTES.includes(current)) current = 'fantasy';
  const area = current.startsWith('fantasy') ? 'fantasy' : 'betting';
  document.body.dataset.area = area;
  document.querySelectorAll('[data-area]').forEach(a => a.classList.toggle('active', a.dataset.area === area));
  document.querySelector('#sidebar').innerHTML = '<small>WORKSPACE</small>' + LINKS[area].map(([id, t]) => `<a href="#${id}" class="${current === id ? 'active' : ''}" ${current === id ? 'aria-current="page"' : ''}>${t}</a>`).join('')
    + (area === 'fantasy' ? '' : '<div class="aside-note">One database.<br>Two ways to analyse.<br><br>From observation to evidence.</div>');
  if (current.startsWith('fantasy')) return mountFantasyTables(content, current === 'fantasy/players' ? 'players' : 'teams');
  if (current === 'data') return mountBettingTables(content);
  if (current === 'betting') return overview(content);
  if (current === 'manual') return manual(content);
  return saved(content);
}
