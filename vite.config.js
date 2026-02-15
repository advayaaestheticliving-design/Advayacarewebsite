import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configure Vite for custom-domain deployment at site root.
// Build output goes to the default /dist folder (used by CI deploy workflow).
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
}));
