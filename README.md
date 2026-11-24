# Expense Tracker Worker

Expense Tracker Worker is a serverless application that records personal spending. It serves a small static front end and exposes a JSON API backed by a Cloudflare D1 database.

## Project structure
```
/
├── index.js        # Worker logic and API routes
├── public/         # Static assets served by the worker
│   ├── settings.js # Shared settings module (categories, budgets, localStorage)
│   ├── scripts.js  # Expense page logic
│   ├── summary.js  # Summary page logic
│   ├── insights.js # Insights page logic
│   └── styles.css  # Global styles
├── schema.sql      # D1 database schema
├── seed.sql        # Seed data for local development
├── wrangler.jsonc  # Wrangler configuration
├── AGENTS.md       # Repository guidelines
└── package.json    # Dependencies and scripts
```

## Prerequisites
- [Node.js](https://nodejs.org/) 22.22.2, 24.15.0, or 26+
- A Cloudflare account with D1 enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Setup
1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/Hoang-Gia-Nguyen/expense-tracker-worker.git
   cd expense-tracker-worker
   npm install
   ```
2. **Create D1 databases**
   ```bash
   npx wrangler d1 create mony-development-db
   npx wrangler d1 create mony-staging-db
   npx wrangler d1 create mony
   ```
   Put the development database ID in the `development` binding in `wrangler.jsonc`. Save the staging and production IDs as GitHub Actions secrets named `STAGING_D1_DATABASE_ID` and `PRODUCTION_D1_DATABASE_ID`; the CI/CD workflow injects those IDs only in its temporary checkout before deploying.
3. **Apply the schema**
   ```bash
   npx wrangler d1 execute mony-development-db --local --file=./schema.sql
   npx wrangler d1 execute mony-staging-db --remote --file=./schema.sql
   npx wrangler d1 execute mony --remote --file=./schema.sql
   ```

## Local development
Run the worker using Wrangler's configured development environment, which permits unauthenticated requests only from localhost:
```bash
npx wrangler dev --env development
```
The application will be available at `http://localhost:8787`.

## Testing
Run the test suite with [Vitest](https://vitest.dev/):
```bash
npm test
```

## Deployment
Deploy the worker to Cloudflare:
```bash
npx wrangler deploy --env production
```
Before deploying, create a Cloudflare Access self-hosted application for each hostname (`expensetracker.hgnlab.org` and `stagetracker.hgnlab.org`) and add the policy for the people allowed to use the tracker. The Access application's audience tag is required by the Worker to verify each request. The D1 placeholders remain in source control; GitHub Actions replaces each with the corresponding database ID secret after tests pass.

Configure the Access team domain and the matching audience tag as Worker secrets for each environment:
```bash
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env production
npx wrangler secret put CF_ACCESS_AUD --env production
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env staging
npx wrangler secret put CF_ACCESS_AUD --env staging
```

`CF_ACCESS_TEAM_DOMAIN` is the Access team host without `https://` (for example, `my-team.cloudflareaccess.com`). `CF_ACCESS_AUD` is the audience tag from that environment's Access application. Production and staging requests fail closed with `503` until both values are configured. Do not set `ALLOW_UNAUTHENTICATED_LOCAL` outside the development environment.

The Worker uses Cloudflare's `ASSETS` binding for the front end. `wrangler.jsonc` configures the Worker to run before assets so the Access check also covers static files.

## Settings

The app includes a settings panel (gear icon in the navbar) where you can:
- **Manage categories**: Add or remove custom categories with color pickers
- **Set budgets**: Per-category monthly budgets and a total monthly budget
- Settings are saved to `localStorage` and persist across sessions

## Contributing
Pull requests and issues are welcome. Please open an issue before submitting large changes.
