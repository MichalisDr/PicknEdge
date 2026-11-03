# Pick n Edge · Αρχιτεκτονική

Τι αρχείο κάνει τι, από πού έρχονται τα δεδομένα και πώς γίνεται μια αλλαγή χωρίς να χαλάσει κάτι άλλο. Πριν από κάθε αλλαγή διαβάζεται αυτό το αρχείο, το `PLAN.md` και το `METRICS.md`.

Κατάσταση: 30/10/2026. Ο φάκελος `site/` είναι αντίγραφο του live site (`euroleague-team-defense.handypine.chatgpt.site`), όπως ήταν στις 18:41 UTC, χωρίς καμία αλλαγή.

## Φάκελοι

| Φάκελος | Περιεχόμενο |
|---|---|
| `site/` | Το site. Στατικά αρχεία, χωρίς build. Ό,τι είναι εδώ ανεβαίνει στη φιλοξενία ως έχει |
| `legacy/` | Το παλιό `dashboard.html`. Δεν το φορτώνει καμία σελίδα· μένει μόνο για αναφορά |
| `notes/chatgpt/` | Οι σημειώσεις που είχαν γραφτεί στον φάκελο του ChatGPT (`BETTING-LIVE.md`, `PERIODS.md` κ.λπ.) |
| `PLAN.md` | Το κοινό πλάνο έργου και το αρχείο αποφάσεων |
| `METRICS.md` | Κατάλογος δεικτών: τύπος, μονάδα, πηγή, αρχείο |

## Πώς ανοίγει τοπικά

```
cd site
python3 -m http.server 8000
```
και μετά `http://localhost:8000/`. Το Betting χρειάζεται ίντερνετ για τα live δεδομένα της EuroLeague. Το Fantasy δουλεύει και χωρίς.

## Σελίδες

| Σελίδα | Τι είναι |
|---|---|
| `index.html` | Η κεντρική σελίδα: Fantasy και Betting, δρομολόγηση με το `#`: `#fantasy` (Teams), `#fantasy/players`, `#betting`, `#schedule`, `#data`, `#manual`, `#saved` |
| `fantasy-profiles.html`, `-3.html`, `-5.html` | Μόνο ανακατεύθυνση στο `#fantasy` (παλιοί σύνδεσμοι)· χωρίς iframe ή δεδομένα |

## Αρχεία και ρόλοι

### Betting (υπεύθυνος: Claude)

| Αρχείο | Ρόλος | Δεδομένα |
|---|---|---|
| `euroleague-data.js` | Κοινή μηχανή (Fantasy + Betting): κατεβάζει πρόγραμμα, box score και play-by-play από την EuroLeague, μετράει κατοχές και πεντάδες, ελέγχει εγκυρότητα, κρατά αγώνες/πρόγραμμα/ρόστερ στο `localStorage` (ξαναλαμβάνει αποτυχημένους αγώνες όταν αλλάζει το `CALC`), εκθέτει `EuroLeagueData` + κοινούς ορισμούς δεικτών (`metrics`), event `euroleague-data` | Live |
| `betting-live-data.js` | Betting: χτίζει `BETTING_TEAMS` / `BETTING_HISTORY` / `BETTING_SCHEDULE` από τη μηχανή. Δεν κάνει αιτήματα. Πρόσοψη `BettingLive` για τα υπόλοιπα αρχεία Betting | Live |
| `betting-stats.js`, `.css` | Πίνακας ομάδων (επίθεση / άμυνα), κατάταξη 1–20, ανανέωση | — |
| `betting-players.js`, `.css` | Πίνακας παικτών, κάρτα παίκτη, μετρητής γραμμής, με/χωρίς συμπαίκτη, «τι επιτρέπει ανά θέση» | — |
| `betting-schedule.js`, `.css` | «Βάσει προγράμματος»: σημεία ομάδων ανά αγώνα | — |
| `team-history.js`, `.css` | Last 3/5/10 ομάδας, game log, γράφημα | — |

Πλήρης περιγραφή: `notes/chatgpt/BETTING-LIVE.md`.

### Fantasy

| Αρχείο | Ρόλος | Δεδομένα |
|---|---|---|
| `fantasy-live.js` | Χτίζει `FANTASY_DATA`, `FANTASY_PERIOD_DATA`, `FANTASY_HISTORY`, `FANTASY_MATCHUP`, `FANTASY_FIXTURES` από τους αγώνες του `EuroLeagueData`. Ξαναχτίζει σε κάθε ενημέρωση (`euroleague-data` → `fantasy-live`) | Live |
| `fantasy-shots.js` | Σουτ ανά αγώνα και ασίστ: δεν κάνει δικές του λήψεις· το `euroleague-data.js` ζητά μία φορά ανά αγώνα Boxscore/PlayByPlay/Points και μοιράζει τα feeds στους καταναλωτές (`EuroLeagueData.register`). Εδώ: Points + PlayByPlay (`assistedShots`, 10ο πεδίο 1/0/null), με έλεγχο έναντι του box score· cache σε `localStorage` | Live |
| `fantasy-metrics.js` | Ορισμοί δεικτών (πίνακες, καρτέλες, hover) και κατάταξη | — |
| `fantasy-workbench.js`, `.css` | Η οθόνη Fantasy: Players / Teams, Profile / Shooting, Table / Charts, κάρτες | — |
| `shot-zones.js`, `.css` | Ορισμός 12 ζωνών / 6 υποπεριοχών / 3 περιοχών, ταξινόμηση σουτ, σταθερό εξαγωνικό πλέγμα, γραμμές γηπέδου. Κοινός για υπολογισμό (`fantasy-shots.js`) και σχεδίαση | — |
| `fantasy-viz.js` | Radar και shooting chart (Hex / Shots, Assisted / Unassisted, hover/πάτημα ζώνης) | — |
| `fantasy-charts.js`, `.css` | Συγκριτικά charts του Charts mode: registry `CHARTS` (ένα αντικείμενο ανά chart, ανά entity/view) + `RENDERERS` ανά τύπο (`scatter`, `venn`)· κοινό zone mapping (Rim/Paint/Mid+Baseline/Corner 3/Above-the-break 3) και benchmarks λίγκας από αθροίσματα· gallery και modal δεν αλλάζουν όταν προστίθεται chart. Τα radar μένουν στις καρτέλες | — |
| `fantasy-stats.css`, `player-card.css`, `fantasy-orange.css` | Στυλ της περιοχής Fantasy | — |
| `team-assets.js` | `PICKNEDGE_TEAMS`: αναγνωριστικό, όνομα, σήμα ομάδας | Στατικό (ταυτότητα) |
| `fantasy-profiles*.html` | Ανακατεύθυνση στο `#fantasy` για παλιούς συνδέσμους | — |

Αφαιρέθηκαν (31/10/2026): `fantasy-data.js`, `fantasy-period-data.js`, `period-data.js`, `fantasy-matchup-data.js`, `fantasy-history-data.js`, `fantasy-provider-snapshots.js`, `fantasy-player-ranks.js`, `betting-team-data.js`, οι παλιές κάρτες (`player-card.js`, `team-card.js`, `profile-card.js`), `fantasy-stats.js`, `fantasy-history.js`, `fantasy-trends.js`. Τα seeds (`betting-games-seed.js`, `betting-players-seed.js`, `fantasy-shots-seed.js`) μετακινήθηκαν σε `tests/fixtures/` και χρησιμοποιούνται μόνο από τα τεστ.

## Ροή δεδομένων σήμερα

**EuroLeague → `euroleague-data.js` (+ `fantasy-shots.js`) → `localStorage` → Betting (`betting-live-data.js`) και Fantasy (`fantasy-live.js`).** Ένα κοινό σύνολο δεδομένων, χωρίς seeds, 3StepsBasket, iframes ή στατικά datasets στο runtime.

- **Πρώτο άνοιγμα (καθαρός browser):** λήψη προγράμματος, box score, play-by-play και σουτ όλων των αγώνων, με 2 παράλληλα αιτήματα και ελάχιστη απόσταση 0,5″. Το Fantasy δείχνει «Λήψη δεδομένων EuroLeague… n/N». Αν η EuroLeague περιορίσει τα αιτήματα (στον browser φαίνεται ως σφάλμα δικτύου), γίνονται 2 ελεγχόμενες επαναλήψεις με αναμονή και μετά διακοπή· ό,τι κατέβηκε κρατιέται και η λήψη συνεχίζεται στο επόμενο άνοιγμα.
- **Επόμενα ανοίγματα:** άμεση εμφάνιση από την προσωρινή μνήμη (τα τελευταία έγκυρα δεδομένα της ίδιας πηγής) και λήψη μόνο όσων λείπουν ή άλλαξαν.
- **Θέσεις, ύψη:** ρόστερ EuroLeague (`feeds.incrowdsports.com`). Όπου λείπουν, φαίνεται «—» και το πλήθος καταγράφεται στη γραμμή κατάστασης.
- **Ομάδες και σήματα:** `team-assets.js` (μόνο ταυτότητα· δεν περιέχει στατιστικά).
- **Δεν υπάρχει εφεδρεία** σε διαφορετικό dataset: χωρίς δεδομένα εμφανίζεται κατάσταση φόρτωσης ή «—».

## Αποθήκευση στον browser

| Κλειδί | Τι κρατά |
|---|---|
| `courtvision-betting-live-E2026-v3` | Αγώνες EuroLeague (σύνολα, παίκτες, κατοχές) |
| `courtvision-betting-people-E2026-v1` | Ρόστερ ομάδων: θέση και ύψος παικτών (ανανέωση το πολύ ανά 12 ώρες) |
| `picknedge-shots-E2026-v2` | Σουτ ανά αγώνα (συντεταγμένες, fast break, second chance, points off turnover, ασίστ 1/0/null· εγγραφές χωρίς ασίστ ξαναφορτώνονται) |
| `picknedge-schedule-E2026-v1` | Τελευταίο έγκυρο πρόγραμμα EuroLeague |
| `cv-fantasy-stars-v1` | Οι ★ παίκτες (δεν χρησιμοποιούνται πια από το Fantasy UI· δεν διαγράφονται) |
| `courtvision-analyses-v1` | Οι αποθηκευμένες αναλύσεις Betting |
| `cv-hypothesis` (sessionStorage) | Υπόθεση που περνά από το πρόγραμμα στη χειροκίνητη ανάλυση |

Τα κλειδιά δεν μετονομάζονται, γιατί θα χάνονταν τα δεδομένα των χρηστών. Αν χρειαστεί αλλαγή μορφής, νέο κλειδί με `-v3` και μεταφορά από το παλιό.

## Κανόνες αλλαγής

1. **Εκδόσεις αρχείων.** Κάθε αρχείο φορτώνεται με `?v=…` (π.χ. `?v=20261031-euroleague2`). Όταν αλλάζει ένα αρχείο, αλλάζει το `?v=` του στο `index.html`, αλλιώς ο browser κρατά το παλιό. Τα `fantasy-profiles*.html` είναι μόνο ανακατευθύνσεις.
2. **Ένα βήμα, ένας κλάδος.** Δουλειά σε branch, έλεγχος, μετά merge στο `main`. Το `main` είναι πάντα αυτό που είναι ή θα είναι live.
3. **Ιδιοκτησία.** Τα αρχεία Betting τα αλλάζει ο Claude· αλλαγή από άλλον μόνο με συνεννόηση (`PLAN.md` §8). Αρχεία Fantasy: όποιος έχει το βήμα, δηλωμένο στο `PLAN.md`.
4. **Κανένα νούμερο με το χέρι στον κώδικα.** Ό,τι αλλάζει ανά γύρο έρχεται από δεδομένα.
5. **Πριν από κάθε merge:** PIR = επίσημο valuation, Fantasy και Betting ανοίγουν χωρίς σφάλματα στην κονσόλα, κάρτα παίκτη και ομάδας ανοίγουν.
6. **Τύποι και κατώφλια** αλλάζουν μόνο μαζί με το `METRICS.md`, και με έγκριση του Μιχάλη.

## Φιλοξενία

Το site δημοσιεύεται στο GitHub Pages: **https://michalisdr.github.io/PicknEdge/** (απόφαση 31/10/2026).

- Κάθε αλλαγή που μπαίνει στο `main` δημοσιεύεται μόνη της. Το κάνει το `.github/workflows/pages.yml`, που ανεβάζει τον φάκελο `site/` όπως είναι.
- Κανείς δεν ανεβάζει αρχεία με το χέρι. Ό,τι δεν είναι στο `main`, δεν είναι στο site.
- Το παλιό site στο ChatGPT Sites (`euroleague-team-defense.handypine.chatgpt.site`) μένει όπως είναι και δεν ενημερώνεται πια.
- Μετά από κάθε δημοσίευση: έλεγχος ότι Fantasy και Betting ανοίγουν στη νέα διεύθυνση.
