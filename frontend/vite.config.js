import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative assets paths for GitHub Pages (e.g. /MyGame/)
  server: {
    port: 5173,
    host: true
  }
});
