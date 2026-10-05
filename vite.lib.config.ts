import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: 'dist-library', lib: { entry: 'src/lens/index.ts', name: 'GlassLens', formats: ['es'], fileName: 'glass-lens' } } });
