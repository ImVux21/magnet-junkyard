import { defineConfig } from 'vite';
import fs from 'node:fs';

const projectRoot = fs.existsSync(process.cwd()) ? fs.realpathSync(process.cwd()) : process.cwd();

export default defineConfig({
  root: projectRoot,
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
