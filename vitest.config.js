import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
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
