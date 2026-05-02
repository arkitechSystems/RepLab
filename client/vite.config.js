import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
    }),
  ],
  build: { sourcemap: true },
  server: {
    host: true,
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
