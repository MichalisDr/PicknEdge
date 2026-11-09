# UI strings translated to English (for review)

The site UI is English everywhere. Greek text is translated when the piece of UI it belongs to is replaced.
Metric names and tooltips come from `site/data/metrics.json` (generated from the registry, English).

## Step 3.2 · Fantasy tables (`site/fantasy-tables.js`, `site/index.html`)

| Where | Before (Greek) | After (English) |
|---|---|---|
| index.html `<html lang>` | `el` | `en` |
| index.html main navigation aria-label | Κύριες περιοχές | Main areas |
| Fantasy · window switch aria-label | Χρονικό δείγμα | Sample window |
| Fantasy · position switch aria-label | Θέση παίκτη | Player position |
| Fantasy · search aria-label | Αναζήτηση Fantasy | Search Fantasy |
| Fantasy · search placeholder | Αναζήτηση… | Search… |
| Fantasy · team filter label / option | Ομάδα / Όλες | Team / All |
| Fantasy · loading message | Λήψη δεδομένων EuroLeague… | Loading data… |
| Fantasy · heading status line | EuroLeague · έως R8 · ενημερώθηκε … | 100 games · latest 2026-11-06 |
| Fantasy · live update button | Ενημέρωση live stats / νέοι αγώνες | removed (the update job covers it) |
| Fantasy · details summary | Δείγμα & υπολογισμοί | Sample & calculations |
| Fantasy · details text | Last 3/5: τελευταίοι ολοκληρωμένοι αγώνες της ομάδας, με πραγματικές συμμετοχές παίκτη. Οι δείκτες προκύπτουν από αθροίσματα, όχι μέσο όρο ποσοστών. … | Last 3 / 5 / 10 are the team's most recent games, counting only the games the player actually played. Every ratio is a sum divided by a sum, never an average of game percentages. … |
| Fantasy · Teams footnote | #1 = καλύτερη άμυνα: χαμηλότερη τιμή (…) · υψηλότερη για Opp TOV και DREB% · Pace: υψηλότερο = #1. Πράσινο = ευνοϊκό για τον αντίπαλο παίκτη. | #1 = best defence: lowest value (…), highest for Opp TOV and DREB%. Pace: highest = #1. Green = favourable for the opposing player. |
| Fantasy · Players footnote | USG και «ανά 100»: — όπου λείπουν πεντάδες/play-by-play (… αγώνες· η λήψη συνεχίζεται) | Players below the form thresholds of the selected window are hidden unless you change this in Filters. n/m = games with the data out of games played. |
| Fantasy · Players header columns | MIN, USG%, PTS /100 … (label + unit) | one label per metric from metrics.json, e.g. "PTS / 100 poss" |

## Step 3.3 · Betting statistics page and shell (`site/betting-tables.js`, `site/app.js`)

League-average label (Fantasy and Betting): "League average" + small text "Full league · … · ignores filters" (Fantasy) / "Full league · all 20 teams, summed" (Betting).

| Where | Before (Greek) | After (English) |
|---|---|---|
| Sidebar · Betting links | Επισκόπηση / Βάσει προγράμματος / Χειροκίνητη ανάλυση / Αποθηκευμένες αναλύσεις / Στατιστικά Betting | Overview / From the schedule / Manual analysis / Saved analyses / Betting statistics |
| Sidebar note | Μία βάση δεδομένων. Δύο τρόποι ανάλυσης. Από την παρατήρηση στην τεκμηρίωση. | One database. Two ways to analyse. From observation to evidence. |
| Overview · title / text | Κάθε σημείο ξεκινά από μία υπόθεση. / Ξεκίνα από τα παιχνίδια της αγωνιστικής … | Every idea starts with a hypothesis. / Start from this round's games … |
| Overview · cards | Βάσει προγράμματος · Παιχνίδι → αδυναμία ομάδας → πιθανός ωφελημένος παίκτης → υπόθεση προς διερεύνηση. · Εξερεύνηση matchups ↗ | From the schedule · Game → team weakness → likely beneficiary player → hypothesis to examine. · Explore matchups ↗ |
| Overview · cards | Έχεις ήδη ένα σημείο; … Νέα χειροκίνητη ανάλυση ↗ | Already have a point? … New manual analysis ↗ |
| Overview | Το αρχείο έρευνάς σου / N αποθηκευμένες → | Your research archive / N saved → |
| Overview · notice | Οι υποθέσεις δεν αποτελούν προβλέψεις. … | Hypotheses are not predictions. … |
| Footer (all Betting pages) | Τα στατιστικά διατηρούν την κάλυψη και τις πηγές του υπάρχοντος dashboard. Πρόγραμμα, στατιστικά ομάδων και παικτών: live από την EuroLeague. Δεν υπάρχει σύνδεση με αποδόσεις. | Statistics are built from the official EuroLeague box scores and play-by-play and refreshed by a scheduled job. There is no connection to betting odds. (the old text said "live from the EuroLeague"; that is no longer true) |
| Manual analysis · title / text | Βάλε το σημείο στο μικροσκόπιο. / Δημιούργησε μία κάρτα έρευνας. … | Put the point under the microscope. / Create a research card. … |
| Manual analysis · fields | Παίκτης, Αντίπαλος, Αγορά, Κατεύθυνση, Γραμμή, Δεκαδική απόδοση, Ημερομηνία παιχνιδιού, Πηγή απόδοσης | Player, Opponent, Market, Direction, Line, Decimal odds, Game date, Odds source |
| Manual analysis · markets | Επιθετικά ριμπάουντ, Συνολικά ριμπάουντ, Πόντοι, Ασίστ, PRA | Offensive rebounds, Total rebounds, Points, Assists, PRA |
| Manual analysis · textareas | Υπόθεση και υποστηρικτικά δεδομένα / Αβεβαιότητες και έλεγχοι που εκκρεμούν (+ placeholders) | Hypothesis and supporting data / Uncertainties and checks pending (+ placeholders) |
| Manual analysis · buttons / status | Δημιουργία κάρτας ανάλυσης → / Αποθήκευση ανάλυσης / Αποθηκεύτηκε σε αυτόν τον browser. / Η αποθήκευση δεν είναι διαθέσιμη … | Create analysis card → / Save analysis / Saved in this browser. / Saving is not available in this browser. |
| Analysis card | ΚΑΡΤΑ ΑΝΑΛΥΣΗΣ / ΥΠΟΘΕΣΗ ΠΡΟΣ ΕΛΕΓΧΟ · Απόδοση · Όριο ισοσκέλισης στην απόδοση · 1 / απόδοση · χωρίς προσαρμογή γκανιότας · Εκτίμηση επιβεβαίωσης · Δεν έχει υπολογιστεί · Υπόθεση & δεδομένα · Αβεβαιότητες · Πηγή απόδοσης | ANALYSIS CARD / HYPOTHESIS TO CHECK · Odds · Break-even at the odds · 1 / odds · no margin adjustment · Confirmation estimate · Not calculated · Hypothesis & data · Uncertainties · Odds source |
| Saved analyses | Το αρχείο των υποθέσεών σου. · Νέα ανάλυση + · Εξαγωγή JSON · Δεν υπάρχουν ακόμη αποθηκευμένες αναλύσεις. | Your archive of hypotheses. · New analysis + · Export JSON · No saved analyses yet. |
| Schedule placeholder (shown only if the matchup script is missing) | Από το matchup στην υπόθεση. … Το πρόγραμμα δεν έχει συνδεθεί ακόμη. … | removed: the matchup page itself is still the old one until 3b |
| Statistics · heading | Το προφίλ κάθε ομάδας. / Σύγκρινε το παιχνίδι της με τον μέσο όρο της διοργάνωσης. | Every team's profile. / Compare each team's game with the competition average. |
| Statistics · heading (players) | Το προφίλ κάθε παίκτη. / Ρόλος, λεπτά και ρυθμοί σε σεζόν και τελευταίους αγώνες. | Every player's profile. / Role, minutes and pace over the season and the latest games. |
| Statistics · switches | Κατηγορία στατιστικών · Πλευρά παιχνιδιού · Επίθεση / Άμυνα | Statistics category · Side of the game · Offense / Defense |
| Statistics · search | Αναζήτηση ομάδας… / Αναζήτηση παίκτη… | Search team… / Search player… |
| Statistics · captions | Τι παράγει η ομάδα / Τι επιτρέπει στον αντίπαλο | What the team produces / What it allows the opponent |
| Statistics · rank legend | καλύτερες / χειρότερες · L3 = κατάταξη στους 3 τελευταίους αγώνες · Hover ή πάτημα σε τιμή για λεπτομέρειες | best / worst · L3 = rank over the last 3 games · Hover or tap a value for details |
| Statistics · league row | Σταθμισμένο · όλες οι ομάδες | Full league · all 20 teams, summed |
| Statistics · footer | Το average ταξινομείται μαζί με τις ομάδες βάσει της επιλεγμένης στήλης. / N ομάδες | The league average is sorted together with the teams by the selected column. / N teams |
| Statistics · empty | Δεν βρέθηκε ομάδα. Ο μέσος όρος παραμένει για ολόκληρη τη διοργάνωση. | No team found. The league average still covers the whole league. |
| Statistics · tooltip | Κατάταξη: Σεζόν … · L3 … | Rank: Season … · L3 … |
| Statistics · method | Δείγμα & υπολογισμοί + long Greek notes (including the 3StepsBasket comparison paragraph) | Sample & calculations + a rewritten English text; the 3StepsBasket paragraph is dropped because that source is gone |
| Players · views | Ρόλος & αποδοτικότητα / Ανά 100 κατοχές / Ανά αγώνα | Role & efficiency / Per 100 possessions / Per game |
| Players · filters | Ομάδα · Θέση · Λεπτά / αγώνα · Όλες/Όλοι | Team · Position · Minutes / game · All |
| Players · trend | L3 vs ΣΕΖΟΝ · ΔMIN · ΔUSG · δεν έπαιξε στους N τελευταίους | L3 vs Season · USG · did not play in the last 3 team games |
| Players · empty | (none) | No players match the filters. |
| Column names and tooltips | 12 team columns and 13+ player columns with Greek tooltips (e.g. «Κατοχές ανά 40 λεπτά …») | one label and one English description per metric from metrics.json |
