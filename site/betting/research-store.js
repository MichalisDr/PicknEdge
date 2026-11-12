/* Saved analysis cards: kept in this browser only (localStorage). */
const KEY = 'courtvision-analyses-v1';

let list = [];
try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(list)) list = []; } catch { list = []; }

/** The saved analyses, oldest first. */
export const records = () => list;
/** Save one more analysis; throws when the browser does not allow storage. */
export function saveRecord(data) {
  localStorage.setItem(KEY, JSON.stringify([...list, data]));
  list.push(data);
}
