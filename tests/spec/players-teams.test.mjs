// The locked Fantasy spec for the Players / Teams toolbar and tables: values live in theme.json / sizes.json / arrangement.json / table-layouts.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const theme = JSON.parse(read('theme/theme.json')).component.fantasy['stat-table'], sizes = JSON.parse(read('config/sizes.json')).component.fantasy['stat-table'];
const arr = JSON.parse(read('config/arrangement.json')).component.fantasy['stat-table'], layouts = JSON.parse(read('config/table-layouts.json'));
const palette = JSON.parse(read('theme/theme.json')).semantic;

test('title row: the title at the left, Profile / Shooting and Table / Charts at the right, 10 px gap; title clamp(24px,5vw,34px)', () => {
  assert.deepEqual(arr['title-row'].parts.map(p => p.name), ['heading-title', 'players-view-row']);
  assert.equal(theme['heading-title']['font-size'].fantasy, 'clamp(24px,5vw,34px)');
  assert.deepEqual([sizes['heading-title'].margin, sizes['title-row'].gap, sizes['title-row']['margin-bottom'], sizes['players-view-row'].gap], ['0', '10px', '10px', '10px']);
  assert.deepEqual(arr['players-view-row'].parts.map(p => p.name), ['view-button', 'players-view-divider', 'mode-tabs']);
});

test('view / mode buttons: min 56 x 44, padding 3 x 4, icon 19, gap 4, 12 px, muted inactive, accent active at 600, divider 1 px line colour', () => {
  for (const k of ['view', 'mode']) {
    assert.deepEqual([sizes[`players-${k}-button`]['min-width'], sizes[`players-${k}-button`]['min-height'], sizes[`players-${k}-button`].padding, sizes[`players-${k}-button`].gap, sizes[`players-${k}-icon`].width, sizes[`players-${k}-icon`].height], ['56px', '44px', '3px 4px', '4px', '19px', '19px']);
    assert.deepEqual([theme[`players-${k}-button`]['font-size'], theme[`players-${k}-button`].text, theme[`players-${k}-button-selected`].text, theme[`players-${k}-button-selected`]['font-weight']], ['12px', '{semantic.muted}', '{semantic.accent-fantasy}', '600']);
  }
  assert.deepEqual([theme['players-view-divider'].background, sizes['players-view-divider'].width], ['{semantic.line}', '1px']);
  assert.deepEqual([theme['buttons-focused'].outline, theme['buttons-focused']['outline-width'], theme['buttons-focused']['outline-offset']], ['{semantic.accent-fantasy}', '2px', '2px']);
});

test('filter row: grid minmax(max-content,1fr) auto minmax(0,215px), gap 8, padding 3 / 9, 1 px bottom line; periods, positions, search group', () => {
  assert.deepEqual(arr['players-toolbar'].parts.map(p => p.name), ['window-buttons', 'position-buttons', 'players-search-group']);
  assert.deepEqual(arr['players-search-group'].parts.map(p => p.name), ['search', 'filters-button']);
  assert.deepEqual([sizes['players-toolbar']['grid-template-columns'], sizes['players-toolbar'].gap, sizes['players-toolbar'].padding, sizes['players-toolbar']['margin-bottom']], ['minmax(max-content,1fr) auto minmax(0,215px)', '8px', '3px 0 9px', '0']);
  assert.deepEqual([theme['players-toolbar']['border-bottom'], theme['players-toolbar']['border-bottom-width']], ['{semantic.line}', '1px']);
  assert.deepEqual(arr['players-toolbar'].parts.filter(p => p.show === 'players').map(p => p.name), ['position-buttons'], 'G / F / C stay Players only');
  assert.deepEqual(arr['players-search-group'].parts.filter(p => p.show === 'players').map(p => p.name), ['filters-button'], 'the funnel stays Players only');
});

test('periods and G / F / C: sizes, outline #534568, text, hover #2C2250, selected accent with weight 600; G/F/C 500', () => {
  assert.deepEqual([sizes['players-window-button']['min-height'], sizes['players-window-button'].padding, sizes['players-window-buttons'].gap, theme['players-window-button'].radius, theme['players-window-button']['font-size']], ['31px', '0 7px', '4px', '5px', '12px']);
  assert.deepEqual([sizes['players-position-button']['min-width'], sizes['players-position-button']['min-height'], sizes['players-position-button'].padding, theme['players-position-button']['font-weight']], ['32px', '35px', '0 6px', '500']);
  for (const k of ['window', 'position']) {
    assert.deepEqual([theme[`players-${k}-button`].border, theme[`players-${k}-button`].text, theme[`players-${k}-button-hovered`].background, theme[`players-${k}-button-selected`].background, theme[`players-${k}-button-selected`].border, theme[`players-${k}-button-selected`]['font-weight']], ['{semantic.border-control}', '{semantic.text}', '{semantic.chip}', '{semantic.accent-fantasy}', '{semantic.accent-fantasy}', '600']);
  }
  assert.equal(palette['border-control'].fantasy, '#534568'); assert.equal(palette.chip.fantasy, '#2c2250');
});

test('search and funnel: group up to 215 px with a 7 px gap; field min 33 px, padding 0 8, icon 17, 12 px, #534568, radius 6, focus grey; funnel 35 x 35, icon 17', () => {
  assert.equal(sizes['players-search-group'].gap, '7px');
  assert.deepEqual([sizes['players-search']['min-height'], sizes['players-search'].padding, sizes['players-search'].gap, sizes['players-search-icon'].width, theme['players-search']['font-size'], theme['players-search'].radius, theme['players-search'].background, theme['players-search-focused'].border, theme['players-search'].placeholder], ['33px', '0 8px', '7px', '17px', '12px', '6px', 'transparent', '{semantic.muted}', '{semantic.muted}']);
  assert.deepEqual([sizes['players-filters-button'].width, sizes['players-filters-button']['min-height'], sizes['players-filters-icon'].width, theme['players-filters-button'].radius, theme['players-filters-button-selected'].background], ['35px', '35px', '17px', '6px', '{semantic.accent-fantasy}']);
});

test('filters panel: 154 px, padding 9, radius 6, gap 6; input margin-top 5, padding 4, radius 4, field colour', () => {
  assert.deepEqual([sizes['filters-panel'].width, sizes['filters-panel'].padding, sizes['filters-panel'].gap, theme['filters-panel'].radius, sizes['filters-field']['margin-top'], sizes['filters-field'].padding, theme['filters-field'].radius, theme['filters-field'].background, theme['filters-label']['font-size']], ['154px', '9px', '6px', '6px', '5px', '4px', '4px', '{semantic.field}', '12px']);
});

test('table: min 1000 px, first column 230 px, cell padding 9 x 8, header violet 11 px / 500, body 12 px, selected column accent / #2C2250 at 600, row hover 7 %, league average mixes 27 % / 74 %', () => {
  assert.deepEqual([sizes.table['min-width'], sizes.cell.padding, layouts.firstCol.min, layouts.firstCol.cap], ['1000px', '9px 8px', 230, 230]);
  assert.deepEqual([theme.header.background, theme['header-cell']['font-size'], theme['header-cell']['font-weight'], theme.table['font-size'], theme['table-body'].background], ['{semantic.violet-header}', '11px', '500', '12px', '{semantic.panel}']);
  assert.deepEqual([theme['header-sorted'].background, theme['header-sorted'].text, theme['sorted-column'].background, theme['sorted-column']['font-weight'], theme['header-sort-arrow']['font-size'], sizes['header-button']['underline-offset']], ['{semantic.sorthead}', '{semantic.white}', '{semantic.sortcell}', '600', '12px', '3px']);
  assert.deepEqual([theme['row-hovered'].background, palette['row-hover']], ['{semantic.row-hover}', '#ffffff12']);
  assert.deepEqual([theme['league-average-row']['tint-percent'], theme['league-average-row']['tint-percent-active'], theme['league-average-row']['font-weight-strong'], theme['league-average-row']['font-weight']], ['27%', '74%', '650', '400']);
  assert.deepEqual([sizes.scrollbar.height, theme['scrollbar-thumb'].radius, theme['scrollbar-thumb'].background, theme['scrollbar-thumb-hovered'].background, theme['scrollbar-track'].background], ['7px', '8px', '{semantic.scroll-thumb}', '{semantic.accent-fantasy}', '{semantic.bg}']);
  const css = read('theme/fantasy/table.css');
  assert.match(css, /\.fw-t th,\.fw-t td\{border:0;border-bottom:/, 'only bottom lines');
  assert.match(css, /tbody tr:hover>\*\{background-image:linear-gradient/, 'a white overlay on top of the cell background');
});

test('player and team cells: badge min 15, name 13 / 550, team code 11 px with 3 px, rank 10 / 400 plain text, city 11 px with 3 px', () => {
  assert.deepEqual([sizes['name-cell-position-badge']['min-width'], theme['name-cell-position-badge'].radius, theme['name-cell-position-badge'].text, theme['name-cell-family-name']['font-size'], theme['name-cell-family-name']['font-weight'], theme['first-column-team-and-position']['font-size'], sizes['first-column-team-and-position']['margin-top']], ['15px', '3px', '{semantic.muted}', '13px', '550', '11px', '3px']);
  assert.deepEqual([theme['rank-chip']['font-size'], theme['rank-chip']['font-weight'], theme['rank-chip'].background, sizes['value-cell'].gap], ['10px', '400', 'transparent', '3px']);
  assert.deepEqual([theme['name-cell-city']['font-size'], sizes['name-cell-city']['margin-top'], theme['name-cell-team-name']['font-weight']], ['11px', '3px', '550']);
  assert.deepEqual([theme['name-cell-value-chip'].text, theme['name-cell-value-chip'].background, sizes['name-cell-sparkline'].width, sizes['name-cell-sparkline'].height, theme['name-cell-sparkline']['line-width']], ['{semantic.positive}', '{semantic.chip}', '26px', '11px', '1.65']);
  assert.equal(arr['name-cell-figures'].push, undefined, 'CR and Value follow the identity');
  assert.equal(arr['players-name-cell'].parts.find(p => p.name === 'name-cell-figures').show, 'when-data', 'hidden while there is no data');
});
