/* Betting research pages that need no statistics: overview, manual analysis (form, card, save) and the saved archive. Markup: research-view.js. */
import { records, saveRecord } from './research-store.js';
import { overviewHtml, manualHtml, resultHtml, savedHtml } from './research-view.js';

export function overview(content) {
  content.innerHTML = overviewHtml(records().length);
}

export function manual(content) {
  content.innerHTML = manualHtml();
  try { document.querySelector('[name=evidence]').value = sessionStorage.getItem('cv-hypothesis') || ''; sessionStorage.removeItem('cv-hypothesis'); } catch { /* no session storage */ }
  document.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target)); data.id = crypto.randomUUID();
    document.querySelector('#result').innerHTML = resultHtml(data);
    document.querySelector('#save').onclick = () => {
      try { saveRecord(data); document.querySelector('#save').disabled = true; document.querySelector('#save-status').textContent = 'Saved in this browser.'; }
      catch { document.querySelector('#save-status').textContent = 'Saving is not available in this browser.'; }
    };
    document.querySelector('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

export function saved(content) {
  content.innerHTML = savedHtml(records());
  document.querySelector('#export').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(records(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'court-vision-analyses.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
