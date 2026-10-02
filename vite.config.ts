import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site under /<repo-name>/. Override with BASE_PATH if needed.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/Espo-AD5-Generalist/',
  plugins: [react()],
});
