# Expense Tracker Application

This project is a simple expense tracker with a web-based interface and a serverless backend powered by Cloudflare Workers and D1.

## Project Structure

This project is a Cloudflare Worker application. The key files and folders are:

```
/
├── .github/                 # GitHub Actions workflows
├── public/                  # Frontend static assets
├── .gitignore               # Git ignore file
├── GEMINI.md                # Gemini CLI configuration
├── index.js                 # Main Cloudflare Worker entry point
├── index.test.js            # Unit tests for the Worker
├── openapi.yaml             # OpenAPI specification for the API
├── package.json             # Project dependencies and scripts
├── README.md                # This file
├── schema.sql               # Database schema for Cloudflare D1
├── vitest.config.js         # Vitest testing framework configuration
└── wrangler.toml            # Cloudflare Wrangler configuration
```

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (which includes npm)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Setup

Follow these steps to set up your development environment:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Hoang-Gia-Nguyen/expense-tracker-worker.git
    cd expense-tracker-worker
    ```

2.  **Install dependencies:**
    This will install `wrangler` and other project dependencies locally.
    ```bash
    npm install
    ```

3.  **Configure Cloudflare D1 Databases:**
    This application uses Cloudflare D1 for its database. You'll need to create two D1 databases: one for development and one for production.

    *   **Login to Wrangler:**
        ```bash
        npx wrangler login
        ```

    *   **Create Development Database:**
        ```bash
        npx wrangler d1 create cf-mony-worker-dev
        ```
        Note down the `database_id` from the output.

    *   **Create Production Database:**
        ```bash
        npx wrangler d1 create cf-mony-worker-prod
        ```
        Note down the `database_id` from the output.

    *   **Apply Database Schema:**
        The database schema is defined in `packages/cf-mony-worker/schema.sql`. Apply it to both your development and production databases:
        ```bash
        npx wrangler d1 execute cf-mony-worker-dev --local --file=./packages/cf-mony-worker/schema.sql
        npx wrangler d1 execute cf-mony-worker-prod --file=./packages/cf-mony-worker/schema.sql
        ```

    *   **Update `wrangler.toml`:**
        Open `packages/cf-mony-worker/wrangler.toml` and update the `database_id` values under the `[[d1_databases]]` section for both `binding = "DB"` (production) and `[env.dev.d1_databases]` (development) with the IDs you obtained in the previous steps. Ensure the `database_name` matches what you used during creation (e.g., `cf-mony-worker-dev`, `cf-mony-worker-prod`).

4.  **Configure Cloudflare Pages Project (for deployment):**
    If you plan to deploy to Cloudflare Pages, update the `project-name` in the `deploy:pages` script within the root `package.json` to match your Cloudflare Pages project name.

## Local Development
    *   **Apply Database Schema:**
        The database schema is defined in `schema.sql`. Apply it to both your development and production databases:
        ```bash
        npx wrangler d1 execute cf-mony-worker-dev --local --file=./schema.sql
        npx wrangler d1 execute cf-mony-worker-prod --file=./schema.sql
        ```

    *   **Update `wrangler.toml`:**
        Open `wrangler.toml` and update the `database_id` values under the `[[d1_databases]]` section for both `binding = "DB"` (production) and `[env.dev.d1_databases]` (development) with the IDs you obtained in the previous steps. Ensure the `database_name` matches what you used during creation (e.g., `cf-mony-worker-dev`, `cf-mony-worker-prod`).
-   Proxy requests from the frontend to the backend, allowing them to work together seamlessly.

You can access the application at `http://localhost:8788` (or the URL provided by Wrangler).

### Debugging

#### Frontend Debugging

Use your browser's developer tools (e.g., Chrome DevTools, Firefox Developer Tools) to debug the frontend application. You can set breakpoints, inspect elements, and monitor network requests.

#### Backend (Cloudflare Worker) Debugging

You can debug the Cloudflare Worker locally using Node.js inspector:

1.  **Start the worker in inspect mode:**
    Navigate to `packages/cf-mony-worker` and run:
    ```bash
    npx wrangler dev --inspect
    ```
    This will provide a `ws://` URL.

2.  **Connect your debugger:**
    *   **Chrome DevTools:** Open `chrome://inspect` in your Chrome browser, click "Open dedicated DevTools for Node", and then click "Connect" to the provided `ws://` URL.
    *   **VS Code:** Create a `launch.json` configuration for "Attach to Node Process" and paste the `ws://` URL.

### Testing

This project uses `vitest` for unit and integration testing.

*   **Run all tests:**
    ```bash
1.  **Start the worker in inspect mode:**
    Run the following command from the project root:
    ```bash
    npx wrangler dev --inspect
    ```
    This will provide a `ws://` URL.
    npm test -- --coverage
    ```
    After running, open `coverage/index.html` in your browser to view the detailed coverage report.

## Deployment

To deploy the entire application to Cloudflare:

```bash
npm run deploy
```

This command will:
1.  Deploy the backend worker (`cf-mony-worker`) to your production environment, connected to your **production** D1 database.
2.  Deploy the frontend application (`web-app`) to Cloudflare Pages.

### Environment Variables

For production deployments, you can manage environment variables through the Cloudflare dashboard for both Workers and Pages. Ensure sensitive information (like API keys) is stored securely as environment variables rather than hardcoded in your application.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.