# Expense Tracker Application

This project is a simple expense tracker with a web-based interface and a serverless backend powered by Cloudflare Workers and D1.

## Project Structure

This project is set up as a monorepo, with the frontend and backend code located in the `packages` directory.

```
/
├── packages/
│   ├── cf-mony-worker/   # The Cloudflare Worker backend
│   └── web-app/          # The frontend web application
├── .gitignore            # Files to be ignored by Git
├── package.json          # Main project configuration and scripts
└── README.md             # This file
```

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (which includes npm)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd fin-app
    ```

2.  **Install dependencies:**
    This will install `wrangler` locally for the project.
    ```bash
    npm install
    ```

3.  **Configure Cloudflare:**
    -   Log in to Wrangler: `npx wrangler login`
    -   Create your production and development D1 databases and update the `database_id` values in `packages/cf-mony-worker/wrangler.toml`.
    -   Update the `project-name` in the `deploy:pages` script in the root `package.json` to match your Cloudflare Pages project name.

## Development

To run the entire application (frontend and backend) locally for development, run the following command from the project root:

```bash
npm run dev
```

This command will:
-   Start a local server for the frontend application.
-   Start a local server for the backend worker, connected to your **development** database.
-   Proxy requests from the frontend to the backend, allowing them to work together seamlessly.

You can access the application at `http://localhost:8788` (or the URL provided by Wrangler).

## Deployment

To deploy the entire application to Cloudflare, run the following command from the project root:

```bash
npm run deploy
```

This will:
1.  Deploy the backend worker (`cf-mony-worker`) to your production environment, connected to your **production** database.
2.  Deploy the frontend application (`web-app`) to Cloudflare Pages.
