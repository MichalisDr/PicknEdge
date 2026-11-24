/* The colour of a team, read from the theme's one team-colour place: theme.json component/fantasy/team-colour, generating the CSS custom properties
   --fantasy-team-colour-primary-<CODE> (the feed's primaryColor of every team, keyed by the PUBLIC code, see assets/teams.js) and --fantasy-team-colour-neutral-colour.
   The neutral list (--fantasy-team-colour-neutral-teams, the four near-black teams) is a display decision: those teams are invisible on the dark surfaces
   and take the neutral colour instead of their primary. It is an explicit list, not a luminance threshold; change it in theme.json only.
   Returns the inline declaration that sets --fade-colour; a style sheet reads it as var(--fade-colour). Used by the player card's portrait fade and by the price chart's dots. */
import THEME from '../theme/theme.json' with { type: 'json' };

const TEAM_COLOUR = THEME.component.fantasy['team-colour'];
/** The public codes that show the neutral colour on a dark surface. */
export const NEUTRAL_TEAMS = TEAM_COLOUR.neutral.teams.split(/\s+/).filter(Boolean);
const NEUTRAL = 'var(--fantasy-team-colour-neutral-colour)';
/** Declaration for the colour a team (public code) takes on a dark surface: its true primary, or the neutral default for a listed team. */
export const teamColourOnSurface = code => {
  const c = String(code).replace(/[^\w-]/g, '');
  return `--fade-colour:${NEUTRAL_TEAMS.includes(c) ? NEUTRAL : `var(--fantasy-team-colour-primary-${c}, ${NEUTRAL})`}`;
};
