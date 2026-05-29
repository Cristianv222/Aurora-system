import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables from system/process env
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Required for hot reloading inside Docker containers
      watch: {
        usePolling: true,
      },
    },
    define: {
      'process.env.REACT_APP_API_BASE_URL': JSON.stringify(env.REACT_APP_API_BASE_URL || 'http://localhost:8090'),
      'process.env.REACT_APP_AUTH_SERVICE': JSON.stringify(env.REACT_APP_AUTH_SERVICE || 'http://localhost:8090'),
      'process.env.REACT_APP_FAST_FOOD_SERVICE': JSON.stringify(env.REACT_APP_FAST_FOOD_SERVICE || 'http://localhost:8090/api/fast-food'),
      'process.env.REACT_APP_RESTAURANT_SERVICE': JSON.stringify(env.REACT_APP_RESTAURANT_SERVICE || 'http://localhost:8090'),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
