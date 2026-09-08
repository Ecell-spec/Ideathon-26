# IDEATHON — Certificate Portal

A static website where a participant types their name and instantly gets their
"Certificate of Participation" — matched against the official IDEATHON
participant list, generated in the browser, and downloadable as PNG or PDF.
No email required, no backend/server needed.

## How it works

1. `data/participants.json` holds the cleaned, de-duplicated list of every
   participant name pulled from `IDEATHON_PARTICIPANTS__1_.xlsx`
   (Team Lead + Team Member 1 + Team Member 2 columns, merged and cleaned).
2. The visitor types their name in the box on the page. As they type, a
   dropdown suggests matching names from the list (autocomplete), and the
   match is also checked on submit (case/spacing-insensitive).
3. On a match, `js/script.js` draws `assets/certificate-template.jpg` onto a
   `<canvas>` and writes the participant's name into the same spot the "Name"
   placeholder occupies on the original design — same maroon color, same
   centered position, auto-sized to fit long names.
4. The visitor downloads the result as a PNG or a PDF — both generated
   client-side, so nothing is uploaded anywhere.

## Running it

Any static file host works — this is plain HTML/CSS/JS, no build step, no
server-side code.

**Quick local test:**
```bash
cd ideathon-certify
python3 -m http.server 8000
# open http://localhost:8000
```

**Deploy:** drag-and-drop the folder onto Netlify/Vercel, or push it to
GitHub Pages, or upload it to any web host / your college server. Just make
sure the folder structure stays intact (`index.html` at the root, with
`assets/`, `css/`, `js/`, `data/` alongside it).

## Updating the participant list

If more participants are added later, or names need correcting, edit
`data/participants.json` directly — it's a plain JSON array of display names:

```json
[
  "Aditya Santosh",
  "Adiba Fatima",
  ...
]
```

No other file needs to change. The matching logic ignores case, spaces, and
punctuation, so "K.Nagasai.Praneeth" and "k nagasai praneeth" both match the
same entry.

### Notes on the source spreadsheet

The original `IDEATHON_PARTICIPANTS__1_.xlsx` is a Google Form export with a
`Team Lead Name`, `Team Member 1 Name`, and `Team Member 2 Name` column per
row (132 rows). It was cleaned to produce `participants.json`:

- All three name columns were merged into one flat list, since every listed
  person gets their own certificate.
- One row had three names bundled into a single free-text cell
  ("Team name : The A - Girls AdibaMahsheen, Ayesha Sultana, Adiba Fatima")
  — this was split into the three individual names.
- A couple of rows had multiple names slash-separated in one cell
  (e.g. "B Vineeth Goud/Sree Teja/Prashant") — split the same way.
- Inconsistent casing/spacing was normalized for matching, while a cleaned
  Title Case version is what's shown on the certificate and used for the
  autocomplete list.
- Duplicate submissions of the same person collapse to a single entry.
- **157 unique names** made it into the final list. Worth a quick manual
  skim of `data/participants.json` before going live — some entries in the
  original sheet were single first names only (e.g. "Aishwarya", "Rohan"),
  which is what the sheet had to work with.

## Customizing the look

`css/style.css` uses the certificate's palette as CSS variables at the top
of the file (`--maroon`, `--ink`, etc.) — change those to re-theme the whole
site in one place. The name's on-certificate font/size/position is
configured at the top of `js/script.js` (`NAME_CENTER_Y_FRAC`,
`NAME_MAX_WIDTH_FRAC`, `NAME_COLOR`, `NAME_FONT_FAMILY`) if the template
image ever changes.
