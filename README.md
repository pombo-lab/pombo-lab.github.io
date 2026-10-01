# Pombo Lab website

The lab website, built with [Astro](https://astro.build) and the
[Astro Scholar](https://astro.build/themes/details/astro-scholar/) theme.

**All of the site's content lives in one spreadsheet:
[`content/lab-content.xlsx`](content/lab-content.xlsx).** People, alumni,
publications, news, and the text on every page come from it.
You don't need to touch any code to update the site.

---

## Updating the website (no coding needed)

1. **Download the spreadsheet.** On GitHub, open `content/lab-content.xlsx` and
   click the download button (↓).
2. **Edit it** in Excel, Numbers, or Google Sheets. Each tab is one part of the
   site, and the **README** tab inside the workbook explains every tab. Hover
   over a column name to see what it's for.
3. **Save it as an Excel workbook (`.xlsx`)** named `lab-content.xlsx`.
   From Google Sheets, use *File › Download › Microsoft Excel (.xlsx)*.
4. **Upload it.** On GitHub, open the `content` folder, choose
   *Add file › Upload files*, drop the file in, and click *Commit changes*.
5. **Wait a few minutes.** The site rebuilds itself. You can follow progress
   under the **Actions** tab:
   - ✅ green tick: the site has been updated.
   - ❌ red cross: something in the spreadsheet needs fixing. Open the failed
     run to see a list like `Members, row 7: site "JHH" is not in the Sites tab`.
     Nothing on the live site changes until the problem is fixed.

### Common edits

| To…                         | Do this                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Add a lab member            | Add a row to **Members**. `Site` must be a code from the **Sites** tab (e.g. `JHU`).          |
| Move someone to alumni      | Delete their **Members** row and add a row to **Alumni**.                                    |
| Add a paper                 | Add a row to **Publications**. Set `Featured` to `yes` to show it on the homepage.            |
| Post news                   | Add a row to **News**. Dates must be written `2026-06-02` (year-month-day).                  |
| Hide something temporarily  | Set its `Show` column to `no`.                                                               |
| Add a photo                 | Upload it to `public/images/people/`, then put its file name (e.g. `jane-doe.jpg`) in `Photo`. |

### Formatting inside cells

- **New paragraph / new bullet:** start a new line inside the cell —
  *Alt+Enter* (Windows), *Control+Option+Return* (Mac Excel), *Ctrl+Enter* (Google Sheets).
- **Links:** `[link text](https://example.org)`, or a page on this site: `[our papers](/publications)`.
  Email addresses and web addresses become links by themselves.
- **Bold:** `**like this**`.

### Using CSV files instead

If you'd rather edit a single tab as a CSV file, name the file after the tab
(`Members.csv`, `News.csv`, … — Google Sheets' `lab-content - Members.csv` works
too). Whoever maintains the site can then run:

```sh
npm run content -- path/to/Members.csv
```

That replaces just that tab in `content/lab-content.xlsx` and updates the site.
In Excel, save CSVs as **CSV UTF-8** so accented names (Szabó, Möller) survive.

---

## For maintainers

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev          # http://localhost:4321 (reads the spreadsheet first)
npm run build        # production build into dist/, plus the search index
npm run preview      # serve dist/
```

### Content scripts

| Command                                           | What it does                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run content`                                 | Reads `content/lab-content.xlsx` and writes `src/data/lab.json` (runs automatically before dev/build). |
| `npm run content -- new.xlsx`                     | Checks `new.xlsx`; if it's valid, it becomes `content/lab-content.xlsx`.                            |
| `npm run content -- Members.csv News.csv`         | Replaces just those tabs, then rewrites `content/lab-content.xlsx`.                                  |
| `npm run content -- some/folder`                  | Every `.xlsx`/`.csv` in the folder.                                                                  |
| `npm run content:check -- file.xlsx`              | Only checks a file and reports problems; changes nothing.                                            |
| `npm run content:template`                        | Rewrites the workbook with the current columns, notes and dropdowns (keeps all data, incl. hidden rows). |
| `npm run content:template -- --csv out/`          | Exports every tab as a CSV.                                                                          |
| `npm run content:template -- --blank empty.xlsx`  | An empty workbook with just the headers.                                                             |

Whenever the workbook is replaced locally, the previous version is kept as
`content/.previous-lab-content.xlsx` (git-ignored). `src/data/lab.json` is
generated and git-ignored; the spreadsheet is the only source of truth.

### How it fits together

- `scripts/content-schema.mjs` — every tab and column: labels, types, help text,
  required fields. **To add a field, add it here**, run `npm run content:template`,
  then use it in a page (and add it to the types in `src/lib/data.ts`).
- `scripts/content-io.mjs` — reads `.xlsx`/`.csv`, validates, writes JSON and workbooks.
- `src/lib/data.ts` — typed access to the generated data for the pages.
- `src/utils/text.ts` — the safe `[link](url)` / `**bold**` formatter for spreadsheet text.
- `src/pages/` — one file per page.
- `src/components/MeltingField.astro` — the interactive chromatin background behind the homepage headline.
- `src/components/Chromatin.astro` — the homepage polymer animation.

### Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and deploys to
GitHub Pages. In the repository settings, set **Pages › Build and deployment ›
Source** to **GitHub Actions** (once). Pull requests are built and the
spreadsheet is checked, but nothing is deployed.

The theme is MIT-licensed; see `LICENSE-astro-scholar`.
