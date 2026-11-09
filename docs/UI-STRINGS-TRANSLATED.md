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
