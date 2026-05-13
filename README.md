# Sow Simple

Sow Simple is a mobile-first gardening reference PWA for a small household. It helps home gardeners pick a USDA zone, search plants, see planting windows, estimate harvest timing, and export reminders as `.ics` calendar files.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Web App Manifest + custom service worker
- Local JSON data only

## Features

- USDA zone picker with zone-bucket mapping for the provided dataset
- Searchable plant library with category chips
- "What can I plant right now?" recommendations based on today and the selected zone
- Plant detail pages with spacing, pruning guidance, companion notes, and planting windows
- Harvest window calculator for direct sow and transplant dates
- Browser-based `.ics` export for planting and harvest reminders
- Recently viewed plants stored in `localStorage`
- Offline-friendly installable PWA after first load

## Project Structure

- `src/app` shared layout
- `src/components` reusable UI pieces
- `src/pages` route-level pages
- `src/data` local dataset, frost anchors, and brand assets
- `src/lib` search, planting-window, storage, harvest, and calendar utilities
- `src/types` provided data types plus compatibility re-exports

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Build the production app:

```bash
npm run build
```

4. Run the automated tests:

```bash
npm run test
```

5. Preview the production build:

```bash
npm run preview
```

## Deploy To GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, open `Pages`.
3. Set `Build and deployment` to `GitHub Actions`.
4. Push to `main` or `master`, or run the `Deploy To GitHub Pages` workflow manually.

Notes:

- The app now uses `HashRouter`, so deep links work on GitHub Pages without a custom SPA fallback.
- Asset and manifest paths are relative, so repository-based Pages URLs such as `https://username.github.io/repo-name/` work without extra base-path edits.

## Deployment QA Checklist

- Load the published site once on desktop and once on a phone.
- Confirm search, category filters, and the cards/list toggle work.
- Open a plant detail page and confirm the page scrolls to the top.
- Run the harvest calculator and download an `.ics` file.
- Refresh a plant detail URL and confirm the route still works on GitHub Pages.
- Install the PWA, then reopen it with the network disabled and confirm search and plant details still work.

## Offline Notes

- The app uses a static `public/manifest.webmanifest` and a custom `public/sw.js`.
- App shell assets, generated static assets, and local JSON-backed data are cached after the first successful load.
- Search, plant details, harvest calculation, recent history, and `.ics` export work offline once cached.

## Data Notes

- The seed JSON remains the source of truth for the normalized plant library.
- Planting dates are approximate household planning references and should still be checked against local weather.
