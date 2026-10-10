import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'tests/consumer',
  plugins: [react()],
  build: { outDir: '../../dist/consumer', emptyOutDir: false },
  server: { host: '0.0.0.0' },
});
