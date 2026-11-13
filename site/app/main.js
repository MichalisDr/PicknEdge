/* Pick n Edge entry point: wires the global behaviours, draws the page for the current route and again whenever the route changes. */
import { render } from './shell.js';
import { installGalleryDialog } from '../fantasy/gallery/gallery-dialog.js';
import { open as openCard } from '../fantasy/cards/card.js';

installGalleryDialog({ openCard });
window.addEventListener('hashchange', render);
render();
