import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json' with { type: 'json' };

const externalPackages = [...Object.keys(packageJson.dependencies), 'react', 'react-dom'];
export default defineConfig({
  plugins: [react(), {
    name: 'ntable-scoped-css',
    enforce: 'pre',
    load(id) { if (id.endsWith('/components/Button.css')) return ''; },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'style.d.ts', source: 'export {};\n' });
      this.emitFile({ type: 'asset', fileName: 'ntable.css', source: readFileSync(new URL('./src/ntable/library.css', import.meta.url), 'utf8') });
    },
  }],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: false,
    lib: { entry: 'src/ntable/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { external: id => externalPackages.some(name => id === name || id.startsWith(`${name}/`)) },
  },
});
