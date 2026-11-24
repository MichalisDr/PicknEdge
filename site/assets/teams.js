/* Team catalogue, the one registry of team identity: id, name (the current EuroLeague feed name), short label, code (the public tvCode the site shows), feed (the feed club code: the key of data/ and of roster.json) and logo file (assets/logos). Identity only, no statistics.
   tests/core/team-registry.test.mjs compares name and code with the roster snapshot, so a drift is caught at the next fetch. */
export const TEAMS = [
{ "id": "anadolu-efes-istanbul", "name": "Anadolu Efes Istanbul", "label": "Efes", "code": "EFS", "feed": "IST", "logo": "assets/logos/anadolu-efes-istanbul.png" },
{ "id": "asvel-lyon-villeurbanne", "name": "LDLC ASVEL Villeurbanne", "label": "ASVEL", "code": "ASV", "feed": "ASV", "logo": "assets/logos/asvel-lyon-villeurbanne.png" },
{ "id": "barcelona", "name": "FC Barcelona", "label": "Barcelona", "code": "BAR", "feed": "BAR", "logo": "assets/logos/barcelona.png" },
{ "id": "baskonia", "name": "Kosner Baskonia Vitoria-Gasteiz", "label": "Baskonia", "code": "KBA", "feed": "BAS", "logo": "assets/logos/baskonia.png" },
{ "id": "bayern-munich", "name": "FC Bayern Munich", "label": "Bayern", "code": "BAY", "feed": "MUN", "logo": "assets/logos/bayern-munich.png" },
{ "id": "besiktas", "name": "Besiktas Fuzul Istanbul", "label": "Besiktas", "code": "BJK", "feed": "BES", "logo": "assets/logos/besiktas.png" },
{ "id": "dubai", "name": "Dubai Basketball", "label": "Dubai", "code": "DUB", "feed": "DUB", "logo": "assets/logos/dubai.png" },
{ "id": "fenerbahce-ulker", "name": "Fenerbahce Tarfin Istanbul", "label": "Fenerbahce", "code": "FBT", "feed": "ULK", "logo": "assets/logos/fenerbahce-ulker.png" },
{ "id": "hapoel-tel-aviv", "name": "Hapoel IBI Tel Aviv", "label": "Hapoel", "code": "HTA", "feed": "HTA", "logo": "assets/logos/hapoel-tel-aviv.png" },
{ "id": "kk-crvena-zvezda", "name": "Crvena Zvezda Meridianbet Belgrade", "label": "Crvena Zvezda", "code": "CZV", "feed": "RED", "logo": "assets/logos/kk-crvena-zvezda.png" },
{ "id": "maccabi-tel-aviv", "name": "Maccabi Rapyd Tel Aviv", "label": "Maccabi", "code": "MTA", "feed": "TEL", "logo": "assets/logos/maccabi-tel-aviv.png" },
{ "id": "milano", "name": "Armani Olimpia Milan", "label": "Milan", "code": "MIL", "feed": "MIL", "logo": "assets/logos/milano.png" },
{ "id": "olympiacos", "name": "Olympiacos Piraeus", "label": "Olympiacos", "code": "OLY", "feed": "OLY", "logo": "assets/logos/olympiacos.png" },
{ "id": "panathinaikos", "name": "Panathinaikos AKTOR Athens", "label": "Panathinaikos", "code": "PAO", "feed": "PAN", "logo": "assets/logos/panathinaikos.png" },
{ "id": "paris-basketball", "name": "Paris Basketball", "label": "Paris", "code": "PBB", "feed": "PRS", "logo": "assets/logos/paris-basketball.png" },
{ "id": "partizan", "name": "Partizan Mozzart Bet Belgrade", "label": "Partizan", "code": "PAR", "feed": "PAR", "logo": "assets/logos/partizan.png" },
{ "id": "real-madrid", "name": "Real Madrid", "label": "Real Madrid", "code": "RMB", "feed": "MAD", "logo": "assets/logos/real-madrid.png" },
{ "id": "valencia", "name": "Valencia Basket", "label": "Valencia", "code": "VBC", "feed": "PAM", "logo": "assets/logos/valencia.png" },
{ "id": "virtus-bologna", "name": "Virtus Bologna", "label": "Virtus", "code": "VIR", "feed": "VIR", "logo": "assets/logos/virtus-bologna.png" },
{ "id": "zalgiris-kaunas", "name": "Zalgiris Kaunas", "label": "Zalgiris", "code": "ZAL", "feed": "ZAL", "logo": "assets/logos/zalgiris-kaunas.png" }
];
