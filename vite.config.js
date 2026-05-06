import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
