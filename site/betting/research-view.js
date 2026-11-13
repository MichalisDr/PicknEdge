/* Markup of the Betting research pages: overview, manual analysis form, analysis card, saved archive. No statistics here. */
import { esc } from '../core/html.js';

const intro = (kicker, title, text, badge = 'WORKSPACE / V1') => `<div class="hero"><div class="intro"><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${text}</p></div><span class="pill">${badge}</span></div>`;
const footer = '<div class="footer">Pick n Edge · EuroLeague research workspace. Statistics are built from the official EuroLeague box scores and play-by-play and refreshed by a scheduled job. There is no connection to betting odds.</div>';

export function overviewHtml(savedCount) {
  return intro('BETTING / RESEARCH', 'Every idea starts with a hypothesis.', 'Start from a point you want to examine and record it on an analysis card.')
    + `<div class="grid">
      <section class="card action"><span class="number">INVESTIGATE</span><h2>Already have a point?</h2><p>Set player, market, line and odds. Record the evidence and what still needs checking.</p><a href="#manual">New manual analysis ↗</a></section></div>
      <div class="section-head"><h2>Your research archive</h2><a class="btn" href="#saved">${savedCount} saved →</a></div>
      <div class="notice">Hypotheses are not predictions. Automated opportunity detection and odds reading are a later phase.</div>` + footer;
}

export function cardHtml(d) {
  return `<article class="card analysis"><div class="eyebrow">ANALYSIS CARD / HYPOTHESIS TO CHECK</div><h2>${esc(d.player)} · ${esc(d.direction)} ${esc(d.line)} ${esc(d.market)}</h2>
      <p>vs ${esc(d.opponent)} ${d.date ? ' · ' + esc(d.date) : ''} · Odds ${esc(d.odds)}</p>
      <div class="grid"><div><span class="muted">Break-even at the odds</span><div class="metric">${(100 / Number(d.odds)).toFixed(1)}%</div><span class="muted">1 / odds · no margin adjustment</span></div>
      <div><span class="muted">Confirmation estimate</span><h2>Not calculated</h2><span class="muted">There is no validated model yet.</span></div></div>
      <div class="saved"><h3>Hypothesis &amp; data</h3><p>${esc(d.evidence || 'Nothing recorded yet.')}</p><h3>Uncertainties</h3><p>${esc(d.uncertainty || 'None recorded — needs checking.')}</p>
      <p class="muted">Odds source: ${esc(d.source || 'Not stated')}</p></div></article>`;
}

export function manualHtml() {
  return intro('BETTING / INVESTIGATE', 'Put the point under the microscope.', 'Create a research card. The odds give the break-even point; a probability estimate needs separate evidence.')
    + `<form id="analysis-form" class="card"><div class="formgrid">
        <label>Player<input name="player" required placeholder="e.g. Zach LeDay" maxlength="120"></label>
        <label>Opponent<input name="opponent" required placeholder="e.g. Virtus Bologna" maxlength="120"></label>
        <label>Market<select name="market"><option>Offensive rebounds</option><option>Total rebounds</option><option>Points</option><option>Assists</option><option>PRA</option></select></label>
        <label>Direction<select name="direction"><option>Over</option><option>Under</option></select></label>
        <label>Line<input name="line" required type="number" min="0" step="0.5" placeholder="1.5"></label>
        <label>Decimal odds<input name="odds" required type="number" min="1.01" step="0.01" placeholder="2.05"></label>
        <label>Game date<input name="date" type="date"></label>
        <label>Odds source<input name="source" maxlength="160" placeholder="Bookmaker / time recorded"></label>
        <label class="wide">Hypothesis and supporting data<textarea name="evidence" maxlength="6000" placeholder="Finding, sample of games, source and date…"></textarea></label>
        <label class="wide">Uncertainties and checks pending<textarea name="uncertainty" maxlength="4000" placeholder="Minutes, absences, rotation changes, missing game logs…"></textarea></label></div>
        <p><button class="btn primary" type="submit">Create analysis card →</button></p></form><div id="result" aria-live="polite"></div>` + footer;
}

export const resultHtml = data => cardHtml(data) + '<p><button id="save" class="btn primary">Save analysis</button></p><p id="save-status" role="status"></p>';

export function savedHtml(records) {
  return intro('BETTING / LIBRARY', 'Your archive of hypotheses.', 'Cards are stored in this browser. Export the file to keep a copy.')
    + `<div class="row"><a class="btn primary" href="#manual">New analysis +</a><button class="btn" id="export" ${records.length ? '' : 'disabled'}>Export JSON</button></div>`
    + (records.length ? records.map(cardHtml).join('') : '<p class="empty">No saved analyses yet.</p>') + footer;
}
