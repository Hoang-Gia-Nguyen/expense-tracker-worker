import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**'], // Exclude node_modules from test discovery
    hookTimeout: 60000, // Increase hook timeout for UI tests
    coverage: {
      provider: 'v8',
      include: ['public/scripts.js', 'index.js'], // Include scripts.js and index.js for coverage
    },
  },
  server: {
    fs: {
      allow: ['./public'], // Allow serving files from the public directory
    },
  },
});
