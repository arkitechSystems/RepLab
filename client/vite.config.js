import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3024',
      '/programs': 'http://localhost:3024',
      '/templates': 'http://localhost:3024',
      '/schedule': 'http://localhost:3024',
      '/sessions': 'http://localhost:3024',
      '/pbs': 'http://localhost:3024',
      '/metrics': 'http://localhost:3024',
      '/admin': 'http://localhost:3024',
      '/feedback': 'http://localhost:3024',
      '/ai': 'http://localhost:3024',
      '/exercises': 'http://localhost:3024',
      '/challenges': 'http://localhost:3024',
      '/trainer': 'http://localhost:3024',
      '/workouts': 'http://localhost:3024',
    },
  },
});
