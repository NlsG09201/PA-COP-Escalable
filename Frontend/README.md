# Frontend

Angular frontend for the internal clinical dashboard.

## Local runtime

The most reliable local setup uses the root Docker stack:

```bash
docker compose up -d
```

With the stack running:

- dashboard UI: `http://localhost:5173`
- API gateway: `http://localhost:8080`

If you only want the Angular app in development mode, you can still run:

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

Browser automation is implemented with Playwright and targets the dashboard app at `http://localhost:5173` by default.

Install browsers once:

```bash
npx playwright install chromium
```

Run the full E2E suite:

```bash
npm run e2e
```

Run the dashboard smoke:

```bash
npm run e2e -- e2e/dashboard/dashboard-smoke.spec.ts
```

Open the interactive Playwright UI:

```bash
npm run e2e:ui
```

## Optional environment variables

You can override the defaults used by Playwright with:

- `PLAYWRIGHT_BASE_URL` for a non-default dashboard URL
- `PLAYWRIGHT_ADMIN_USERNAME` for dashboard login
- `PLAYWRIGHT_ADMIN_PASSWORD` for dashboard login

Default dashboard credentials in the local Docker stack:

- username: `admin@cop.local`
- password: `Admin123ChangeMe`
