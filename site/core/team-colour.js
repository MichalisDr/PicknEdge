/* The colour of a team, read from the theme's one team-colour index: theme.json component/fantasy/player-card/header-portrait-fade/team-colour-<TEAM>, which generates the CSS custom properties
   --fantasy-player-card-header-portrait-fade-team-colour-<TEAM>. A team without an entry (none filled yet) falls back to the index's own default-colour: no colour is invented here.
   Returns the inline declaration that sets --fade-colour; a style sheet reads it as var(--fade-colour). Used by the player card's portrait fade and by the price chart's dots. */
export const teamColour = team => `--fade-colour:var(--fantasy-player-card-header-portrait-fade-team-colour-${String(team).replace(/[^\w-]/g, '')}, var(--fantasy-player-card-header-portrait-fade-default-colour))`;
