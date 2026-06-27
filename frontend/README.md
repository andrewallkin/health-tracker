# Frontend

React nutrition and check-in dashboard. See the [root README](../README.md) for project overview.

## Development

```bash
npm install
npm run dev
```

With Docker dev stack: **http://localhost:3000** (see root README).

Local Vite only: **http://localhost:5173** (proxies `/api` to backend on :8000).

Vitest uses a separate `vitest.config.ts` (Vite 8 and Vitest ship incompatible config types when merged).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run preview` | Preview production build |

## Source layout

```
src/
├── components/
│   ├── layout/       # App shell, nav, footer, flow routing
│   ├── nutrition/    # Dashboard, pages, shared meal components
│   ├── checkin/      # Check-in day/week/month views
│   └── health/       # Garmin-style health views (mock data)
├── hooks/            # useNutritionData, useCheckInData, useEstimateFlow
├── lib/              # API client, dates, aggregates, helpers
├── context/          # Auth
└── types/            # TypeScript types
```
