// Test helper: makes the site's shared data object (site/core/data.js) read the files the build wrote to site/data, straight from disk.
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { create } from '../../site/core/data-loader.js';
import { Data } from '../../site/core/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'data');
const BASE = 'http://localhost/data/';

export function realLoader() {
  const fetchFn = async u => {
    const path = u.slice(BASE.length).split('?')[0];
    try { const text = readFileSync(join(root, path), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(text) }; }
    catch { return { ok: false, status: 404, json: async () => ({}) }; }
  };
  const importer = u => import(pathToFileURL(join(root, u.slice(BASE.length).split('?')[0])).href);
  return create({ base: BASE, fetch: fetchFn, importer });
}

/** Point `Data` at the generated files. Returns a function that puts the previous methods back. */
export function useRealData() {
  const saved = { ...Data };
  Object.assign(Data, realLoader());
  return () => Object.assign(Data, saved);
}

/** Read a file of the site as text. */
export const siteFile = rel => readFileSync(join(root, '..', rel), 'utf8');

/** Load the toolbar icons from site/assets/icons (what the page does with fetch). */
export async function useIcons() {
  const { loadIcons } = await import('../../site/core/icons.js');
  const { TOOLBAR_ICONS } = await import('../../site/fantasy/tables/table-toolbar.js');
  await loadIcons([...TOOLBAR_ICONS, 'profile', 'target'], async name => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'assets', 'icons', name + '.svg'), 'utf8'));
}
