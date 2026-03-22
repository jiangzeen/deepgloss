import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [
    preact(),
    crx({ manifest }),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        pdfviewer: 'src/pdfviewer/index.html',
        pdfbridge: 'src/pdfviewer/bridge.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
