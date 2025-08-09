import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  server: {
    fs: {
      allow: ['./public'], // Allow serving files from the public directory
    },
  },
});