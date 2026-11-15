# Player portraits

300x400 WebP with transparency, one file per player: `<playerId>.webp`. They are made by hand, not by the automatic data update:

    npm install
    npm run portraits

Run it by hand when rosters change. It takes every URL from the roster's own `images.headshot` and downloads only new or changed ones (record: `data/portraits.json`). Then run `node scripts/build/site-data.mjs`, which fills `portrait` in `roster.json` from the files that exist.

Players without a file have no `portrait` and show the team logo.
