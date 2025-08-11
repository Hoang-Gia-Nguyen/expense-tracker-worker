# Expense Tracker Worker

Expense Tracker Worker is a serverless application that records personal spending. It serves a small static front end and exposes a JSON API backed by a Cloudflare D1 database.

## Project structure
```
/
├── index.js        # Worker logic and API routes
├── public/         # Static assets served by the worker
├── schema.sql      # D1 database schema
├── wrangler.toml   # Wrangler configuration
└── package.json    # Dependencies and scripts
```

## Prerequisites
- [Node.js](https://nodejs.org/) 18+
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
   npx wrangler d1 create cf-mony-worker-dev
   npx wrangler d1 create cf-mony-worker-prod
   ```
   Update `wrangler.toml` with the returned `database_id` values.
3. **Apply the schema**
   ```bash
   npx wrangler d1 execute cf-mony-worker-dev --local --file=./schema.sql
   npx wrangler d1 execute cf-mony-worker-prod --file=./schema.sql
   ```

## Local development
Run the worker using Wrangler:
```bash
npx wrangler dev
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
npx wrangler deploy
```
Make sure `wrangler.toml` is configured with your production database.

## Contributing
Pull requests and issues are welcome. Please open an issue before submitting large changes.
