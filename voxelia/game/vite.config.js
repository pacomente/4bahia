import { defineConfig } from 'vite';

export default defineConfig({
  root: 'game',
  base: './',            // rutas relativas: el launcher lo abre con file://
  build: { outDir: '../dist/game', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5180 },
});
