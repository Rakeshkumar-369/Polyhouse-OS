import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: React on :5173 calls the API on :4000. Build: every screen becomes its own small lazy chunk.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2019', cssCodeSplit: true, rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'] } } } },
  server: { host: true, proxy: { '/api': 'http://localhost:4000' } },
});
