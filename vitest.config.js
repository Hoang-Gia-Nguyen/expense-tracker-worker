import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**'],
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      include: ['public/scripts.js', 'public/settings.js', 'index.js'], // Include scripts.js and index.js for coverage
    },
  },
  server: {
    fs: {
      allow: ['./public'],
    },
  },
});
