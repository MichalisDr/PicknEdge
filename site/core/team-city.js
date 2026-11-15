/* The two lines of a team card's title: the club name and, smaller below it, the approved city or locality (config/team-cities.json, by the stable team
   catalogue id). The display name itself is never changed (lookups, navigation and tooltips keep using it).
   - no city for the team: the display name alone, no second line;
   - an approved short club name (`club`): used as the first line;
   - else, when the city is a trailing part of the display name ("Hapoel IBI Tel Aviv" + "Tel Aviv"): the rest of the name on the first line, so the city shows once;
   - else: the display name on the first line and the city below it. */
export function teamTitleLines(displayName, entry) {
  const city = typeof entry?.city === 'string' ? entry.city.trim() : '';
  if (!city) return { club: displayName, city: null };
  const club = typeof entry.club === 'string' ? entry.club.trim() : '';
  if (club) return { club, city };
  if (displayName.length > city.length + 1 && displayName.endsWith(' ' + city)) return { club: displayName.slice(0, -city.length).trim(), city };
  return { club: displayName, city };
}
