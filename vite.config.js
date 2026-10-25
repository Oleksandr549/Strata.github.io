import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: { main: 'index.html', notFound: '404.html' },
      output: {
        manualChunks: { three: ['three'] }
      }
    }
  },
  server: { host: true },
  preview: { host: true }
});
