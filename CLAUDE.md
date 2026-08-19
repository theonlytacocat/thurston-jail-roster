# Thurston County Jail Roster — Project Context

## What it is
A public jail roster monitor for Thurston County, WA. Scrapes the Sheriff's Office roster search page every 30 minutes, tracks bookings and releases, and displays them on a public website.

## URLs
- **Live site:** (not deployed yet — will be https://theonlytacocat.github.io/thurston-jail-roster/ once GitHub Pages is enabled)
- **GitHub repo:** (not created yet — see setup steps below)
- **Source data:** Thurston County Sheriff — https://www.co.thurston.wa.us/cm/sheriff/bureau-corrections-roster-search.asp?mod=fourth

## Architecture
- **Scraper:** `scrape.js` — standalone Node.js script, runs via GitHub Actions cron every 30 min
- **Frontend:** React + Vite, served as static files on GitHub Pages (`gh-pages` branch)
- **Data storage:** JSON files committed to git in `data/` — no server, no database
- **Hosting cost:** $0

## Key technical notes
- No CAPTCHA — plain HTTP with **axios + cheerio** (same style as Kitsap), no Playwright needed
- The roster page (`mod=fourth`) is a single unpaginated page listing every current inmate — no pagination to handle
- Each inmate has an `idnum` (e.g. `Z0072311`), used in place of a booking number — it's the only stable identifier the site exposes
- Detail pages (`mod=third&idnum=X`) only expose **charge info**: court, cause number, charge, bail, arrest date. Unlike Pierce/Kitsap, Thurston does **not** expose age/sex/race/height/weight/photo — the frontend and data model reflect that (no `DeepStats`/`Stats` pages; not enough demographic data to make them meaningful)
- `bookingDate` is derived as the earliest `arrestDate` across a person's charges, since the roster has no explicit booking date field
- Release detection is diff-based only (no live release feed like Kitsap's XML endpoint): if an `idnum` drops off the roster page, it's marked released
- Detail fetching is incremental to be polite to a small county server: new bookings get detail fetched in a capped batch (30), and a rolling backfill (40/run) fills in detail for anyone still missing it — mirrors Pierce's approach rather than Kitsap's full-refresh-every-run approach, since Thurston's roster (~280 people) is much larger than Kitsap's

## Key files
- `scrape.js` — main scraper script, writes all `data/*.json` files
- `scrapers/thurston.js` — roster + detail page scraping logic (axios/cheerio)
- `utils.js` — `nowPST()` helper with `hourCycle: 'h23'` (prevents midnight 24:xx bug)
- `data/change_log.json` — full history of all bookings/releases
- `data/roster.json` — current roster state, keyed by `idnum`
- `data/status.json` — `{inCustody, lastUpdated}`
- `.github/workflows/scrape.yml` — GitHub Actions workflow (scrape + build + deploy)
- `frontend/src/App.jsx` — React app, HashRouter, fetches from `./data/*.json`
- `frontend/vite.config.js` — `base: './'` for GitHub Pages compatibility

## Data format
- `change_log.json` is an array of booking entries, newest first
- Each entry: `idnum`, `bookingNumber` (alias of idnum), `name`, `status` (in_custody/released), `firstSeen`, `releasedAt`, `bookingDate`, `charges[]`, `hasDetail`
- Each charge: `{ court, causeNumber, charge, bail, arrestDate }`
- `name` format: `LAST, FIRST MIDDLE`
- `firstSeen` format: "MM/DD/YYYY, HH:MM:SS" (PST)

## Color scheme
- Amber/bronze theme (distinct from Kitsap's blue and Pierce's green)
- Background: #16130F, primary accent: #A85C2E, highlight: #D9A860

## Related projects
- **Kitsap Jail Roster** — https://theonlytacocat.github.io/ksco-scraper/
- **Pierce County Jail Roster** — https://theonlytacocat.github.io/pierce-jail-roster/
- **Mason County Jail Roster** — https://alexasroster.com (also serves the wajaildata.org hub page)
- **Washington Jail Data hub** — https://wajaildata.org — landing page linking all county monitors; served from `mason-jail-roster/server.js` around line 822 (`.nav-section`). Add a new `<a class="nav-btn">` entry there once this site is live.

## Setup steps still needed (not done by Claude — required GitHub push access this session didn't have)
1. Create a GitHub repo `thurston-jail-roster` under theonlytacocat
2. `git remote add origin ...` and push this project
3. Enable GitHub Pages (Settings → Pages → deploy from `gh-pages` branch), same as the other repos
4. Trigger the `scrape.yml` workflow once manually (workflow_dispatch) to confirm it runs end-to-end
5. Add the Thurston link to `mason-jail-roster/server.js`'s `.nav-section` (wajaildata.org hub)
