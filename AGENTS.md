# Repository Guidelines

## Project Structure & Module Organization

```
/
├── index.js              # Worker entry point — router, middleware, export
├── src/
│   ├── middleware/       # cors.js, errorHandler.js
│   ├── routes/          # expenses.js, summary.js, insights.js, api/config/
│   └── config/          # frontendConfig.ts, sharedTypes.ts
├── public/              # Static frontend (HTML, CSS, JS, TS)
├── schema.sql           # D1 database schema
├── seed.sql             # Seed data for local development
├── drop.sql             # D1 teardown script
├── openapi.yaml         # API specification
├── index.test.js        # Worker API tests
├── static-assets.test.js# Static asset tests
└── vitest.config.js     # Test configuration
```

- Backend logic lives in `src/routes/`; shared middleware in `src/middleware/`.
- Frontend pages reside under `public/{expense,summary,insights}/`.
- TypeScript sources in `src/` compile to the worker entry, but `index.js` and `public/scripts.js` remain JS.
- SQL files (`schema.sql`, `seed.sql`) are versioned alongside code for D1 provisioning.

## Build, Test, and Development Commands

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm test` | Run unit & integration tests with Vitest |
| `npx vitest --coverage` | Run tests with coverage report |
| `npx wrangler dev` | Start local dev server at `http://localhost:8787` |
| `npx wrangler deploy` | Deploy to Cloudflare Workers (production) |
| `npx wrangler d1 execute <db> --local --file=schema.sql` | Apply schema locally |
| `npx vitest run --config vitest.ci.config.js` | CI test run (excludes UI tests) |

## Coding Style & Naming Conventions

- **Indentation**: 2 spaces, no tabs.
- **Language**: Modern JavaScript (ESM, `import`/`export`). TypeScript is used in `src/` for shared types and config.
- **Naming**:
  - Files: `kebab-case.js` or `camelCase.js` for JS modules; `PascalCase.ts` for type/class modules.
  - Variables & functions: `camelCase`.
  - Routes: plural nouns (`/api/expenses`, `/api/summary`).
  - SQL bindings: `UPPER_SNAKE_CASE` for environment bindings (`D1_DATABASE`, `ANALYTICS_TEST`).
- **Formatting**: No automatic formatter configured; keep code clean and consistent with existing style.
- **Imports**: External packages first, then internal modules with relative paths.

## Testing Guidelines

- **Framework**: [Vitest](https://vitest.dev/) with `jsdom` environment.
- **Coverage**: Run `npx vitest --coverage` (provider: `v8`); `index.js` and `public/scripts.js` are the coverage targets.
- **Test file naming**: `*.test.js` co-located with the source file or at the project root (e.g., `index.test.js`, `static-assets.test.js`).
- **Structure**: Use `describe` / `it` blocks with clear, descriptive names. Mock `D1_DATABASE` via `vi.fn()` — see `index.test.js` for the established pattern.
- **Static asset tests**: Use `jsdom` to verify HTML structure and script behavior.

## Commit & Pull Request Guidelines

- **Conventional Commits**: Use prefixes like `feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `test:` (e.g., `feat: Implement Phase 3 - Frontend Modernization`, `ci: Restrict PR review workflow to main branch`).
- **Scope (optional)**: Add a scope in parentheses when relevant (e.g., `ci(gemini): pin model`).
- **PR descriptions**: Summarize changes, link related issues, and include screenshots for UI changes. Use draft PRs for work-in-progress.
## Security & Configuration Tips

- **Credentials**: Never commit real `database_id` values. The `wrangler.jsonc` in the repo uses development-only IDs.
- **Environment variables / bindings**: Declare D1, Analytics Engine, and KV bindings in `wrangler.jsonc` per environment (`development` / `production`).
- **Validation**: Incoming API payloads are validated with `zod` in route handlers. Keep validation strict — do not trust raw request bodies.
- **CORS**: Enabled globally via `src/middleware/cors.js`. Ensure allowed origins reflect deployment domains.
