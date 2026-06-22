# Frontend

React nutrition and health dashboard. See the [root README](../README.md) for project overview.

## Development

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Source layout

```
src/
├── components/
│   ├── layout/       # App shell, nav, footer
│   ├── nutrition/    # Dashboard, pages, shared meal components
│   └── health/       # Garmin-style health views
├── data/             # Mock data
├── lib/              # Utilities and storage
└── types/            # TypeScript types
```
