import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOCAL_BOLTON_PATHS = [
  path.join(
    os.homedir(),
    'Calibre Library',
    'Unknown',
    'BOLTON 2005 , Contract Theory (13)',
    'BOLTON 2005 , Contract Theory - Unknown.pdf'
  ),
  path.join(
    os.homedir(),
    'Downloads',
    'BOLTON 2005 , Contract Theory - Unknown.pdf'
  ),
  path.resolve('sources', 'bolton_2005.pdf'),
];

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'margin-local-pdf-middleware',
      configureServer(server) {
        server.middlewares.use('/api/local-pdf/bolton', (req, res, next) => {
          const found = LOCAL_BOLTON_PATHS.find(
            (p) => fs.existsSync(p) && fs.statSync(p).size > 500_000
          );
          if (!found) {
            next();
            return;
          }
          const stat = fs.statSync(found);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', String(stat.size));
          fs.createReadStream(found).pipe(res);
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
