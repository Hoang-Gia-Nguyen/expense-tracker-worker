# Workspace Overview

This workspace is designed for working with a **Wrangler** application, which contains the code for a **Cloudflare Worker**.

The application includes both **frontend** and **backend** components:

- **Frontend**:
  - A web interface for receiving transaction inputs.
  - Displays historical transaction data.

- **Backend**:
  - Interacts with a **Cloudflare D1** database.
  - Provides API endpoints consumed by the frontend.

This setup allows seamless interaction between the user-facing interface and the backend services, all deployed on Cloudflare's serverless infrastructure.

# Working style
- Do not modify GEMINI.md
- Always run npm test to verify change.