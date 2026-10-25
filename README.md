# taskly-sample

A tiny task tracker: Express API, SQLite (Node's built-in `node:sqlite`), and a plain JavaScript page. It is the sample app that [Foundry](https://foundry-portfolio.vercel.app) changes. Pull requests here are opened by Foundry's agents for visitors of that site, and are closed automatically after a day.

## Run it

```bash
npm install
npm start          # http://localhost:3000
npm test           # API tests (node:test)
npm run e2e        # browser smoke test (needs: npx playwright install chromium)
```

Needs Node 22.13 or newer. The database is in memory unless you set `DB_PATH`.

## Layout

- `src/db.js`: schema and the four task queries.
- `src/app.js`: Express routes under `/api/tasks`.
- `src/server.js`: starts the server.
- `public/`: the page (`index.html`, `app.js`, `style.css`).
- `tests/`: API tests. `e2e/`: Playwright test.
