import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configure Vite for GitHub Pages project deployment under /Advayacarewebsite/
// Build output goes to the default /dist folder (used by CI deploy workflow).
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/Advayacarewebsite/' : '/',
  plugins: [react()],
}));
