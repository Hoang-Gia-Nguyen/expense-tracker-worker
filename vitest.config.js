import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**'],
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      include: ['public/scripts.js', 'index.js'],
    },
  },
  server: {
    fs: {
      allow: ['./public'],
    },
  },
});
