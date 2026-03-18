# PublicWeb

Angular frontend for the public booking website.

## Local runtime

The recommended local setup uses the root Docker stack:

```bash
docker compose up -d
```

With the stack running:

- public website: `http://localhost:5174`
- dashboard: `http://localhost:5173`
- API gateway: `http://localhost:8080`

For local development mode only:

```bash
npm start
```

## Build

To create a production build:

```bash
npm run build
```

## Unit tests

Unit tests use Angular's test builder with Vitest globals:

```bash
npm test
```

## End-to-end automation

Playwright targets the public website at `http://localhost:5174` by default.

Install browsers once:

```bash
npx playwright install chromium
```

Run the full public suite:

```bash
npm run e2e
```

Run the public booking smoke:

```bash
npm run e2e -- e2e/public/public-booking.spec.ts
```

Run the public-to-dashboard demo flow:

```bash
npm run e2e:demo
```

Open the interactive Playwright UI:

```bash
npm run e2e:ui
```

## Optional environment variables

You can override:

- `PLAYWRIGHT_BASE_URL` for the public website URL
- `PLAYWRIGHT_DASHBOARD_BASE_URL` for dashboard navigation during demo flows
- `PLAYWRIGHT_ADMIN_USERNAME` for dashboard login
- `PLAYWRIGHT_ADMIN_PASSWORD` for dashboard login
