/* The My Team page (#fantasy/my-team): a personal virtual team builder, kept in this browser only. The title is the Players / Teams title (same parts, same wrapper). */

export const pageHtml = () => '<section class="fantasy-stats fw-workbench mt-page"><div data-part="fantasy.stat-table.title-row"><h1 data-part="fantasy.stat-table.heading-title">My Team</h1></div></section>';

export function mount(target) {
  target.innerHTML = pageHtml();
}
