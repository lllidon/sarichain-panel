import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BACKEND_');
  const proxy = {
    '/api': {
      target: process.env.BACKEND_URL || env.BACKEND_URL || 'http://127.0.0.1:3001',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, ''),
    },
  };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});
