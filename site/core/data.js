/* The one data loader of the page, reading the generated files in site/data (next to this folder). */
import { create } from './data-loader.js';

export const Data = create({ base: new URL('../data/', import.meta.url).href });
