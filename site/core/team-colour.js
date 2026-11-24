/* The colour of a team, read from the theme's one team-colour place: theme.json component/fantasy/team-colour, generating the CSS custom properties
   --fantasy-team-colour-primary-<CODE> (the feed's primaryColor of every team, keyed by the PUBLIC code, see assets/teams.js) and --fantasy-team-colour-neutral-colour,
   the fallback for a code that is not in the registry (an unknown or future team). No team is treated differently from another.
   Returns the inline declaration that sets --fade-colour; a style sheet reads it as var(--fade-colour). Used by the player card's portrait fade and by the price chart's dots. */
export const teamColour = code => `--fade-colour:var(--fantasy-team-colour-primary-${String(code).replace(/[^\w-]/g, '')}, var(--fantasy-team-colour-neutral-colour))`;
