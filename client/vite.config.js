import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/programs': 'http://localhost:3001',
      '/templates': 'http://localhost:3001',
      '/schedule': 'http://localhost:3001',
      '/sessions': 'http://localhost:3001',
      '/pbs': 'http://localhost:3001',
      '/metrics': 'http://localhost:3001',
    },
  },
});
